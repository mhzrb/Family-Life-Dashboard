import { env } from "cloudflare:workers";
import { secureJson } from "../../../lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  const bindings = env as unknown as Record<string, string | undefined>;
  const publicDemo = bindings.PUBLIC_DEMO?.trim().toLowerCase() === "true";
  let secureAppUrl = "";
  if (publicDemo && bindings.SECURE_APP_URL) {
    try {
      const candidate = new URL(bindings.SECURE_APP_URL.trim());
      if (candidate.protocol === "https:") secureAppUrl = candidate.toString();
    } catch {
      secureAppUrl = "";
    }
  }

  return secureJson({ publicDemo, secureAppUrl });
}
