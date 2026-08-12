import { env } from "cloudflare:workers";
import {
  processTelegramUpdate,
  type TelegramUpdate,
} from "../../../lib/telegram-server";
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
  return { token, secret };
}

export async function POST(request: Request) {
  const { secret } = telegramBindings();
  if (!secret)
    return new Response("Webhook is not configured", { status: 503 });
  if (request.headers.get("x-telegram-bot-api-secret-token") !== secret)
    return new Response("Unauthorized", { status: 401 });
  await processTelegramUpdate((await request.json()) as TelegramUpdate);
  return Response.json({ ok: true });
}

export async function GET(request: Request) {
  if (!(await requestIdentity(request)))
    return secureJson({ error: "Sign in required" }, { status: 401 });
  const { token, secret } = telegramBindings();
  const missing = [
    !token ? "TELEGRAM_BOT_TOKEN" : "",
    !secret ? "TELEGRAM_WEBHOOK_SECRET" : "",
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
      webhookReady = Boolean(
        result.ok &&
          result.result?.url ===
            new URL("/api/telegram", request.url).toString(),
      );
    } catch {
      /* Keep status false without exposing secret values. */
    }
  }
  return secureJson({ status: "ready", configured, webhookReady, missing });
}
