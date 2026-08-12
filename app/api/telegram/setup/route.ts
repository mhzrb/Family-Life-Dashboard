import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { members } from "../../../../db/schema";
import { requestIdentity } from "../../../../lib/server-auth";
import { sameOrigin, secureJson, writeAudit } from "../../../../lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return secureJson({ error: "Cross-site requests are not allowed" }, { status: 403 });
  const identity = await requestIdentity(request);
  if (!identity) return Response.json({ error: "Sign in required" }, { status: 401 });

  const db = await getDb();
  const [member] = await db
    .select()
    .from(members)
    .where(and(eq(members.email, identity.email), eq(members.status, "active")))
    .limit(1);
  if (!member || member.role !== "owner") {
    return Response.json({ error: "Only the household owner can activate the bot" }, { status: 403 });
  }

  const { env } = await import("cloudflare:workers");
  const bindings = env as unknown as Record<string, string | undefined>;
  const token = bindings.TELEGRAM_BOT_TOKEN;
  const secret = bindings.TELEGRAM_WEBHOOK_SECRET;
  if (!token || !secret) return Response.json({ error: "Telegram secrets are not configured" }, { status: 503 });
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) {
    return Response.json({ error: "The webhook secret may only contain letters, numbers, underscores and hyphens" }, { status: 400 });
  }

  const webhookUrl = new URL("/api/telegram", request.url).toString();
  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: webhookUrl, secret_token: secret, allowed_updates: ["message", "callback_query"], drop_pending_updates: false }),
  });
  const result = await response.json() as { ok?: boolean; description?: string };
  if (!response.ok || !result.ok) {
    return secureJson({ error: result.description || "Telegram could not enable secure sync" }, { status: 502 });
  }
  await writeAudit({ householdId: member.householdId, actorMemberId: member.id, action: "telegram.webhook_enabled", entityType: "telegram", summary: "Enabled permanent secure Telegram webhook" });
  return secureJson({ ok: true, webhookReady: true });
}
