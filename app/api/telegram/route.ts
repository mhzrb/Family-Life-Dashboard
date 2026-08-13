import { env } from "cloudflare:workers";
import { requestIdentity } from "../../../lib/server-auth";
import { secureJson } from "../../../lib/security";

function telegramBindings() {
  const bindings = env as unknown as Record<string, unknown>;
  const token =
    typeof bindings.TELEGRAM_BOT_TOKEN === "string"
      ? bindings.TELEGRAM_BOT_TOKEN.trim()
      : "";
  const secret =
    typeof bindings.TELEGRAM_WEBHOOK_SECRET === "string"
      ? bindings.TELEGRAM_WEBHOOK_SECRET.trim()
      : "";
  const webhookUrl =
    typeof bindings.TELEGRAM_WEBHOOK_URL === "string"
      ? bindings.TELEGRAM_WEBHOOK_URL.trim()
      : "";
  return { token, secret, webhookUrl };
}

export async function POST() {
  return secureJson(
    { error: "Telegram updates are handled by the dedicated webhook Worker" },
    { status: 410 },
  );
}

export async function GET(request: Request) {
  if (!(await requestIdentity(request)))
    return secureJson({ error: "Sign in required" }, { status: 401 });
  const { token, secret, webhookUrl } = telegramBindings();
  const missing = [
    !token ? "TELEGRAM_BOT_TOKEN" : "",
    !secret ? "TELEGRAM_WEBHOOK_SECRET" : "",
    !webhookUrl ? "TELEGRAM_WEBHOOK_URL" : "",
  ].filter(Boolean);
  const configured = missing.length === 0;
  let webhookReady = false;
  if (configured) {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${token}/getWebhookInfo`,
        { cache: "no-store" },
      );
      const result = (await response.json()) as {
        ok?: boolean;
        result?: { url?: string };
      };
      webhookReady = Boolean(result.ok && result.result?.url === webhookUrl);
    } catch {
      /* Keep status false without exposing secret values. */
    }
  }
  return secureJson({ status: "ready", configured, webhookReady, missing });
}
