import { processTelegramUpdate, type TelegramUpdate } from "../../../lib/telegram-server";
import { requestIdentity } from "../../../lib/server-auth";
import { secureJson } from "../../../lib/security";

export async function POST(request: Request) {
  const { env } = await import("cloudflare:workers");
  const bindings = env as unknown as Record<string, string | undefined>;
  const expectedSecret = bindings.TELEGRAM_WEBHOOK_SECRET;
  if (!expectedSecret) return new Response("Webhook is not configured", { status: 503 });
  if (request.headers.get("x-telegram-bot-api-secret-token") !== expectedSecret) {
    return new Response("Unauthorized", { status: 401 });
  }
  await processTelegramUpdate((await request.json()) as TelegramUpdate);
  return Response.json({ ok: true });
}

export async function GET(request: Request) {
  if (!requestIdentity(request)) return secureJson({ error: "Sign in required" }, { status: 401 });
  const { env } = await import("cloudflare:workers");
  const bindings = env as unknown as Record<string, string | undefined>;
  const configured = Boolean(bindings.TELEGRAM_BOT_TOKEN && bindings.TELEGRAM_WEBHOOK_SECRET);
  let webhookReady = false;
  if (configured) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${bindings.TELEGRAM_BOT_TOKEN}/getWebhookInfo`, { cache: "no-store" });
      const result = await response.json() as { ok?: boolean; result?: { url?: string } };
      webhookReady = Boolean(result.ok && result.result?.url === new URL("/api/telegram", request.url).toString());
    } catch { /* Status stays unavailable without exposing configuration. */ }
  }
  return secureJson({ status: "ready", configured, webhookReady, format: "24.50 groceries Weekly shop" });
}
