export function requestIdentity(request: Request) {
  const email = request.headers.get("cf-access-authenticated-user-email");
  const encodedName = request.headers.get("cf-access-authenticated-user-name");
  const encoding = request.headers.get("cf-access-authenticated-user-name-encoding");
  const host = new URL(request.url).hostname;
  const isLocal = host === "terminal.local" || host === "localhost" || host === "127.0.0.1";

  if (!email && !isLocal) return null;

  let name: string | null = null;
  if (encodedName && encoding === "percent-encoded-utf-8") {
    try {
      name = decodeURIComponent(encodedName);
    } catch {
      name = null;
    }
  }

  return {
    email: (email ?? "mahsa@example.com").toLowerCase(),
    name: name ?? (email ? email.split("@")[0] : "Mahsa"),
    isLocal,
  };
}
