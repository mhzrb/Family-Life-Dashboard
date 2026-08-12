import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { members } from "../../../../db/schema";
import { requestIdentity } from "../../../../lib/server-auth";
import { syncTelegramUpdates } from "../../../../lib/telegram-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Cross-site requests are not allowed" }, { status: 403 });
  const identity = await requestIdentity(request);
  if (!identity) return Response.json({ error: "Sign in required" }, { status: 401 });
  const db = await getDb();
  const [member] = await db.select({ id: members.id }).from(members).where(and(eq(members.email, identity.email), eq(members.status, "active"))).limit(1);
  if (!member) return Response.json({ error: "Active membership required" }, { status: 403 });
  const result = await syncTelegramUpdates();
  return Response.json(result, { status: result.ok ? 200 : 502 });
}
