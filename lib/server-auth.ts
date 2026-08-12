import { createRemoteJWKSet, jwtVerify } from "jose";

type RemoteJwkSet = ReturnType<typeof createRemoteJWKSet>;

let cachedJwks: RemoteJwkSet | null = null;
let cachedJwksUrl: string | null = null;

function jwksFor(url: string) {
  if (!cachedJwks || cachedJwksUrl !== url) {
    cachedJwks = createRemoteJWKSet(new URL(url));
    cachedJwksUrl = url;
  }
  return cachedJwks;
}

export async function requestIdentity(request: Request) {
  const host = new URL(request.url).hostname;
  const isLocal =
    host === "terminal.local" ||
    host === "localhost" ||
    host === "127.0.0.1";

  if (isLocal) {
    return {
      email: "mahsa@example.com",
      name: "Mahsa",
      isLocal: true,
    };
  }

  const { env } = await import("cloudflare:workers");
  const bindings = env as unknown as Record<string, string | undefined>;

  const rawTeamDomain = bindings.TEAM_DOMAIN?.trim();
  const audience = bindings.POLICY_AUD?.trim();
  const token = request.headers.get("cf-access-jwt-assertion");

  if (!rawTeamDomain || !audience || !token) return null;

  const teamDomain = (
    rawTeamDomain.startsWith("https://")
      ? rawTeamDomain
      : `https://${rawTeamDomain}`
  ).replace(/\/+$/, "");

  try {
    const { payload } = await jwtVerify(
      token,
      jwksFor(`${teamDomain}/cdn-cgi/access/certs`),
      {
        issuer: teamDomain,
        audience,
      },
    );

    const email =
      typeof payload.email === "string"
        ? payload.email.trim().toLowerCase()
        : "";

    if (!email || !email.includes("@")) return null;

    const name =
      typeof payload.name === "string" && payload.name.trim()
        ? payload.name.trim()
        : email.split("@")[0];

    return {
      email,
      name,
      isLocal: false,
    };
  } catch {
    return null;
  }
}
