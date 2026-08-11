import { and, asc, eq, isNull } from "drizzle-orm";
import { getDb } from "../../../db";
import { households, members, transactions } from "../../../db/schema";
import { requestIdentity } from "../../../lib/server-auth";
import { enforceRateLimit, writeAudit } from "../../../lib/security";

export const dynamic = "force-dynamic";

function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  const identity = requestIdentity(request);
  if (!identity) return Response.json({ error: "Sign in required" }, { status: 401 });
  const db = await getDb();
  const [member] = await db.select().from(members).where(and(eq(members.email, identity.email), eq(members.status, "active"))).limit(1);
  if (!member) return Response.json({ error: "Active membership required" }, { status: 403 });
  const rate = await enforceRateLimit(`export:${member.id}`, 5, 10 * 60_000);
  if (!rate.allowed) return Response.json({ error: "Please wait before creating another export" }, { status: 429, headers: { "retry-after": String(rate.retryAfter) } });

  const [household] = await db.select().from(households).where(eq(households.id, member.householdId)).limit(1);
  const family = await db.select().from(members).where(eq(members.householdId, member.householdId));
  const rows = await db.select().from(transactions).where(and(eq(transactions.householdId, member.householdId), isNull(transactions.deletedAt))).orderBy(asc(transactions.happenedAt));
  const memberNames = new Map(family.map((item) => [item.id, item.name]));
  const format = new URL(request.url).searchParams.get("format") === "json" ? "json" : "csv";
  const date = new Date().toISOString().slice(0, 10);

  await writeAudit({ householdId: member.householdId, actorMemberId: member.id, action: "data.exported", entityType: "household", entityId: member.householdId, summary: `Exported household data as ${format.toUpperCase()}` });

  if (format === "json") {
    const safeMembers = family.map((item) => ({ id: item.id, householdId: item.householdId, email: item.email, name: item.name, color: item.color, role: item.role, status: item.status, createdAt: item.createdAt, removedAt: item.removedAt }));
    return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), household, members: safeMembers, transactions: rows }, null, 2), {
      headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="family-expenses-${date}.json"`, "cache-control": "no-store", "x-content-type-options": "nosniff" },
    });
  }

  const header = ["Date", "Member", "Amount", "Currency", "EUR amount", "Category", "Note", "Source"];
  const lines = [header.map(csvCell).join(","), ...rows.map((item) => [item.happenedAt, memberNames.get(item.memberId) ?? "Former member", (item.amountCents / 100).toFixed(2), item.currency, (item.baseAmountCents / 100).toFixed(2), item.category, item.note, item.source].map(csvCell).join(","))];
  return new Response(`\uFEFF${lines.join("\r\n")}`, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="family-expenses-${date}.csv"`, "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}
