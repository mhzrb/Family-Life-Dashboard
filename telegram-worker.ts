import { env } from "cloudflare:workers";
import {
  processTelegramUpdate,
  type TelegramUpdate,
} from "./lib/telegram-server";

const encoder = new TextEncoder();

function bindings() {
  const values = env as unknown as Record<string, unknown>;
  const token =
    typeof values.TELEGRAM_BOT_TOKEN === "string"
      ? values.TELEGRAM_BOT_TOKEN.trim()
      : "";
  const secret =
    typeof values.TELEGRAM_WEBHOOK_SECRET === "string"
      ? values.TELEGRAM_WEBHOOK_SECRET.trim()
      : "";
  return { token, secret };
}

async function secureEqual(left: string, right: string) {
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftHash);
  const rightBytes = new Uint8Array(rightHash);
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "permissions-policy": "camera=(), microphone=(), geolocation=()",
    },
  });
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const { token, secret } = bindings();

    if (
      request.method === "GET" &&
      (url.pathname === "/" || url.pathname === "/health")
    ) {
      return json({
        status: "ready",
        configured: Boolean(token && secret),
      });
    }

    if (url.pathname !== "/telegram") {
      return json({ error: "Not found" }, 404);
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    if (!token || !secret) {
      return json({ error: "Webhook is not configured" }, 503);
    }

    const suppliedSecret =
      request.headers.get("x-telegram-bot-api-secret-token") ?? "";
    if (!suppliedSecret || !(await secureEqual(suppliedSecret, secret))) {
      return json({ error: "Unauthorized" }, 401);
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("application/json")) {
      return json({ error: "JSON required" }, 415);
    }

    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > 1_000_000) {
      return json({ error: "Request too large" }, 413);
    }

    try {
      const update = (await request.json()) as TelegramUpdate;
      if (!Number.isInteger(update?.update_id)) {
        return json({ error: "Invalid Telegram update" }, 400);
      }
      await processTelegramUpdate(update);
      return json({ ok: true });
    } catch {
      return json({ error: "Unable to process update" }, 500);
    }
  },
};
