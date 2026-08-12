import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "../../../db";
import { households, members, transactions } from "../../../db/schema";
import { requestIdentity } from "../../../lib/server-auth";
import { secureJson } from "../../../lib/security";

export const dynamic = "force-dynamic";

function csvCell(value: unknown) {
  const raw = String(value ?? "");
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  const identity = await requestIdentity(request);
  if (!identity)
    return secureJson({ error: "Sign in required" }, { status: 401 });

  const db = await getDb();
  const [member] = await db
    .select()
    .from(members)
    .where(and(eq(members.email, identity.email), eq(members.status, "active")))
    .limit(1);
  if (!member)
    return secureJson({ error: "Active member not found" }, { status: 404 });

  const [household] = await db
    .select()
    .from(households)
    .where(eq(households.id, member.householdId))
    .limit(1);
  const items = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.householdId, member.householdId),
        eq(transactions.memberId, member.id),
        isNull(transactions.deletedAt),
      ),
    )
    .orderBy(desc(transactions.happenedAt));

  const format = new URL(request.url).searchParams.get("format");
  if (format === "csv") {
    const columns = [
      "date",
      "amount",
      "currency",
      "category",
      "note",
      "type",
      "source",
    ];
    const rows = items.map((item) =>
      [
        item.happenedAt,
        (item.amountCents / 100).toFixed(2),
        item.currency,
        item.category,
        item.note,
        item.type,
        item.source,
      ]
        .map(csvCell)
        .join(","),
    );
    return new Response([columns.join(","), ...rows].join("\n"), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition":
          "attachment; filename=family-expenses-my-data.csv",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  }

  return secureJson(
    {
      exportedAt: new Date().toISOString(),
      household: household
        ? {
            id: household.id,
            name: household.name,
            baseCurrency: household.baseCurrency,
            city: household.city,
          }
        : null,
      member: {
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
      },
      transactions: items,
    },
    {
      headers: {
        "content-disposition":
          "attachment; filename=family-expenses-my-data.json",
      },
    },
  );
}
