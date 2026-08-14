import { and, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  households,
  householdDailyBudgets,
  householdMonthlyBudgets,
  auditLogs,
  expenseCategories,
  members,
  telegramLinks,
  transactions,
} from "../../../db/schema";
import { requestIdentity } from "../../../lib/server-auth";
import { budgetDateKey, budgetMonthKey } from "../../../lib/budget";
import {
  enforceRateLimit,
  safeIsoDate,
  sameOrigin,
  secureJson,
  writeAudit,
} from "../../../lib/security";

export const dynamic = "force-dynamic";

const palette = ["#1d6b5a", "#e2764f", "#8b6ccf", "#d5a634", "#4076b9"];
const allowedCategories = [
  "Groceries",
  "Dining",
  "Transport",
  "Home",
  "Health",
  "Leisure",
  "Bills",
  "Other",
];
const supportedCurrencies = ["EUR", "USD", "CAD", "GBP"] as const;

async function exchangeRate(from: string, to: string) {
  if (from === to) return 1;
  const response = await fetch(
    `https://api.frankfurter.dev/v2/rates?base=${encodeURIComponent(from)}&quotes=${encodeURIComponent(to)}`,
  );
  if (!response.ok) throw new Error("Rate unavailable");
  const rows = (await response.json()) as Array<{ quote: string; rate: number }>;
  const rate = rows.find((row) => row.quote === to)?.rate;
  if (!rate || !Number.isFinite(rate)) throw new Error("Rate unavailable");
  return rate;
}

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function code() {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase();
}

function linkExpiry() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

async function currentMember(request: Request) {
  const identity = await requestIdentity(request);
  if (!identity) return null;
  const db = await getDb();
  const existing = await db
    .select()
    .from(members)
    .where(eq(members.email, identity.email))
    .limit(1);
  if (existing[0]) {
    if (existing[0].status !== "active") return null;
    const now = new Date();
    const previousSeen = existing[0].lastSeenAt
      ? new Date(existing[0].lastSeenAt).getTime()
      : 0;
    const shouldRefreshPresence =
      !existing[0].joinedAt ||
      !Number.isFinite(previousSeen) ||
      now.getTime() - previousSeen >= 30 * 60 * 1000;
    if (!shouldRefreshPresence) return existing[0];
    const seenAt = now.toISOString();
    const joinedAt = existing[0].joinedAt ?? seenAt;
    await db
      .update(members)
      .set({ joinedAt, lastSeenAt: seenAt })
      .where(eq(members.id, existing[0].id));
    return { ...existing[0], joinedAt, lastSeenAt: seenAt };
  }

  const now = new Date().toISOString();
  const householdId = crypto.randomUUID();
  const memberId = crypto.randomUUID();
  await db.batch([
    db.insert(households).values({
      id: householdId,
      name: `${identity.name}'s home`,
      kind: "family",
      baseCurrency: "EUR",
      city: "Hengelo",
      createdAt: now,
    }),
    db.insert(householdDailyBudgets).values({
      id: crypto.randomUUID(),
      householdId,
      effectiveDate: budgetDateKey(now),
      dailyBudgetCents: 2_000,
      createdAt: now,
    }),
    db.insert(members).values({
      id: memberId,
      householdId,
      email: identity.email,
      name: identity.name,
      nameKey: normalizeName(identity.name),
      color: palette[0],
      role: "owner",
      canViewHousehold: true,
      status: "active",
      telegramLinkCode: code(),
      telegramLinkCodeExpiresAt: linkExpiry(),
      joinedAt: now,
      lastSeenAt: now,
      createdAt: now,
    }),
  ]);
  const created = await db
    .select()
    .from(members)
    .where(eq(members.id, memberId))
    .limit(1);
  return created[0];
}

async function dashboardPayload(
  db: Awaited<ReturnType<typeof getDb>>,
  member: typeof members.$inferSelect,
) {
  const [household] = await db
    .select()
    .from(households)
    .where(eq(households.id, member.householdId))
    .limit(1);
  const family = await db
    .select()
    .from(members)
    .where(eq(members.householdId, member.householdId));
  const canViewFamily =
    member.role === "owner" || Boolean(member.canViewHousehold);
  const activity = await db
    .select()
    .from(transactions)
    .where(
      canViewFamily
        ? and(
            eq(transactions.householdId, member.householdId),
            isNull(transactions.deletedAt),
          )
        : and(
            eq(transactions.householdId, member.householdId),
            eq(transactions.memberId, member.id),
            isNull(transactions.deletedAt),
          ),
    )
    .orderBy(desc(transactions.happenedAt));
  const familyBudgetActivity = await db
    .select({
      id: transactions.id,
      type: transactions.type,
      baseAmountCents: transactions.baseAmountCents,
      happenedAt: transactions.happenedAt,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.householdId, member.householdId),
        isNull(transactions.deletedAt),
      ),
    );
  const names = new Map(family.map((item) => [item.id, item.name]));
  const customCategories = await db
    .select()
    .from(expenseCategories)
    .where(
      and(
        eq(expenseCategories.householdId, member.householdId),
        isNull(expenseCategories.archivedAt),
      ),
    )
    .orderBy(expenseCategories.name);
  const recentAudit = await db
    .select()
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.householdId, member.householdId),
        eq(auditLogs.actorMemberId, member.id),
      ),
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(40);
  const monthlyBudgetRows = await db
    .select({
      month: householdMonthlyBudgets.month,
      adjustmentCents: householdMonthlyBudgets.adjustmentCents,
    })
    .from(householdMonthlyBudgets)
    .where(eq(householdMonthlyBudgets.householdId, member.householdId));
  const dailyBudgetRows = await db
    .select({
      effectiveDate: householdDailyBudgets.effectiveDate,
      dailyBudgetCents: householdDailyBudgets.dailyBudgetCents,
    })
    .from(householdDailyBudgets)
    .where(eq(householdDailyBudgets.householdId, member.householdId))
    .orderBy(householdDailyBudgets.effectiveDate);
  const currentMonth = budgetMonthKey();
  const savedCurrentAdjustment = monthlyBudgetRows.find(
    (item) => item.month === currentMonth,
  )?.adjustmentCents;
  const currentAdjustment =
    savedCurrentAdjustment ??
    (household?.budgetAdjustmentMonth === currentMonth
      ? household.budgetAdjustmentCents
      : 0);

  const visibleFamily = canViewFamily
    ? family
    : family.filter((item) => item.id === member.id);
  const privateFamily = visibleFamily.map((item) =>
    item.id === member.id
      ? item
      : {
          ...item,
          email: "",
          telegramLinkCode: "",
          telegramLinkCodeExpiresAt: null,
        },
  );

  return {
    household: {
      ...household,
      budgetAdjustmentCents: currentAdjustment,
    },
    budgetAdjustmentCents: currentAdjustment,
    monthlyBudgetAdjustments: monthlyBudgetRows,
    dailyBudgetRules: dailyBudgetRows,
    currentMemberId: member.id,
    members: privateFamily,
    transactions: activity,
    familyBudgetTransactions: familyBudgetActivity as Array<{
      id: string;
      type: "expense" | "income";
      baseAmountCents: number;
      happenedAt: string;
    }>,
    membershipRequests: [],
    categories: customCategories.map((item) => ({
      id: item.id,
      name: item.name,
    })),
    auditLogs: recentAudit.map((item) => ({
      ...item,
      actorName: item.actorMemberId
        ? (names.get(item.actorMemberId) ?? "Former member")
        : "System",
    })),
  };
}

async function activeFamily(
  db: Awaited<ReturnType<typeof getDb>>,
  householdId: string,
) {
  return db
    .select()
    .from(members)
    .where(
      and(eq(members.householdId, householdId), eq(members.status, "active")),
    );
}

async function ensureUniqueMember(
  db: Awaited<ReturnType<typeof getDb>>,
  householdId: string,
  name: string,
  email: string,
) {
  const nameKey = normalizeName(name);
  const duplicateName = await db
    .select({ id: members.id })
    .from(members)
    .where(
      and(
        eq(members.householdId, householdId),
        eq(members.status, "active"),
        sql`lower(trim(${members.name})) = ${nameKey}`,
      ),
    )
    .limit(1);
  if (duplicateName[0])
    throw new HttpError(
      409,
      "A member with that name already exists in this household",
    );

  const duplicateEmail = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.email, email), eq(members.status, "active")))
    .limit(1);
  if (duplicateEmail[0])
    throw new HttpError(
      409,
      "That email already belongs to an active household member",
    );

  return nameKey;
}

export async function GET(request: Request) {
  try {
    const member = await currentMember(request);
    if (!member)
      return Response.json({ error: "Sign in required" }, { status: 401 });

    const db = await getDb();
    return secureJson(await dashboardPayload(db, member));
  } catch {
    return Response.json(
      { error: "Unable to load dashboard" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request))
      return secureJson(
        { error: "Cross-site requests are not allowed" },
        { status: 403 },
      );
    const member = await currentMember(request);
    if (!member)
      return Response.json({ error: "Sign in required" }, { status: 401 });
    const rate = await enforceRateLimit(`dashboard:${member.id}`, 45);
    if (!rate.allowed)
      return secureJson(
        { error: "Too many requests. Please wait a moment." },
        { status: 429, headers: { "retry-after": String(rate.retryAfter) } },
      );
    const body = (await request.json()) as Record<string, unknown>;
    const db = await getDb();

    if (body.action === "requestAddMember") {
      if (member.role !== "owner")
        return secureJson(
          { error: "Only the household owner can add members" },
          { status: 403 },
        );
      const name = String(body.name ?? "").trim();
      const email = String(body.email ?? "")
        .trim()
        .toLowerCase();
      if (
        !name ||
        name.length > 80 ||
        email.length > 254 ||
        !email.includes("@")
      ) {
        return Response.json(
          { error: "A name and valid email are required" },
          { status: 400 },
        );
      }
      await ensureUniqueMember(db, member.householdId, name, email);
      const family = await activeFamily(db, member.householdId);
      const now = new Date().toISOString();
      const newMember = {
        id: crypto.randomUUID(),
        householdId: member.householdId,
        name,
        nameKey: normalizeName(name),
        email,
        color: palette[family.length % palette.length],
        role: "member" as const,
        canViewHousehold: false,
        status: "active" as const,
        telegramLinkCode: code(),
        telegramLinkCodeExpiresAt: linkExpiry(),
        joinedAt: null,
        lastSeenAt: null,
        createdAt: now,
      };
      await db.insert(members).values(newMember);
      await writeAudit({
        householdId: member.householdId,
        actorMemberId: member.id,
        action: "member.added",
        entityType: "member",
        entityId: newMember.id,
        summary: `Added ${name}`,
      });
      return Response.json(await dashboardPayload(db, member), { status: 201 });
    }

    if (body.action === "requestRemoveMember") {
      if (member.role !== "owner")
        return secureJson(
          { error: "Only the household owner can remove members" },
          { status: 403 },
        );
      const targetMemberId = String(body.targetMemberId ?? "");
      if (!targetMemberId || targetMemberId === member.id) {
        return Response.json(
          { error: "You cannot remove your own account" },
          { status: 400 },
        );
      }
      const family = await activeFamily(db, member.householdId);
      const target = family.find((item) => item.id === targetMemberId);
      if (!target)
        return Response.json(
          { error: "Active member not found" },
          { status: 404 },
        );
      if (family.length <= 1)
        return Response.json(
          { error: "A household must keep at least one member" },
          { status: 400 },
        );
      const now = new Date().toISOString();
      await db.batch([
        db
          .update(members)
          .set({ status: "removed", removedAt: now, nameKey: null })
          .where(eq(members.id, target.id)),
        db.delete(telegramLinks).where(eq(telegramLinks.memberId, target.id)),
      ]);
      await writeAudit({
        householdId: member.householdId,
        actorMemberId: member.id,
        action: "member.removed",
        entityType: "member",
        entityId: target.id,
        summary: `Removed ${target.name}`,
      });
      return Response.json(await dashboardPayload(db, member));
    }

    if (body.action === "setHouseholdVisibility") {
      if (member.role !== "owner")
        return secureJson(
          { error: "Only the household owner can change viewing access" },
          { status: 403 },
        );
      const targetMemberId = String(body.targetMemberId ?? "");
      const allowed = body.allowed === true;
      const [target] = await db
        .select()
        .from(members)
        .where(
          and(
            eq(members.id, targetMemberId),
            eq(members.householdId, member.householdId),
            eq(members.status, "active"),
            ne(members.id, member.id),
          ),
        )
        .limit(1);
      if (!target)
        return secureJson({ error: "Active member not found" }, { status: 404 });
      await db
        .update(members)
        .set({ canViewHousehold: allowed })
        .where(eq(members.id, target.id));
      await writeAudit({
        householdId: member.householdId,
        actorMemberId: member.id,
        action: allowed ? "member.household_view_granted" : "member.household_view_revoked",
        entityType: "member",
        entityId: target.id,
        summary: `${allowed ? "Granted" : "Revoked"} household overview access for ${target.name}`,
      });
      return secureJson(await dashboardPayload(db, member));
    }

    if (body.action === "updateBudgetAdjustment") {
      if (member.role !== "owner")
        return secureJson(
          { error: "Only the household owner can adjust the family budget" },
          { status: 403 },
        );
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || Math.abs(amount) > 1_000_000)
        return secureJson(
          { error: "Enter a valid adjustment between -1,000,000 and 1,000,000" },
          { status: 400 },
        );
      const adjustmentCents = Math.round(amount * 100);
      const month = budgetMonthKey();
      const now = new Date().toISOString();
      await db.batch([
        db
          .insert(householdMonthlyBudgets)
          .values({
            id: crypto.randomUUID(),
            householdId: member.householdId,
            month,
            adjustmentCents,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [
              householdMonthlyBudgets.householdId,
              householdMonthlyBudgets.month,
            ],
            set: { adjustmentCents, updatedAt: now },
          }),
        db
          .update(households)
          .set({
            budgetAdjustmentCents: adjustmentCents,
            budgetAdjustmentMonth: month,
          })
          .where(eq(households.id, member.householdId)),
      ]);
      await writeAudit({
        householdId: member.householdId,
        actorMemberId: member.id,
        action: "budget.adjusted",
        entityType: "household",
        entityId: member.householdId,
        summary: `Set ${month} budget adjustment to ${amount.toFixed(2)} base-currency units`,
      });
      return secureJson(await dashboardPayload(db, member));
    }

    if (body.action === "updateFamilyBudgetSettings") {
      if (member.role !== "owner")
        return secureJson(
          { error: "Only the household owner can change budget settings" },
          { status: 403 },
        );
      const amount = Number(body.dailyBudget);
      const currency = String(body.baseCurrency ?? "").toUpperCase();
      if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000)
        return secureJson(
          { error: "Enter a daily budget greater than zero" },
          { status: 400 },
        );
      if (!(supportedCurrencies as readonly string[]).includes(currency))
        return secureJson({ error: "Unsupported base currency" }, { status: 400 });

      const [currentHousehold] = await db
        .select()
        .from(households)
        .where(eq(households.id, member.householdId))
        .limit(1);
      if (!currentHousehold)
        return secureJson({ error: "Household not found" }, { status: 404 });

      const now = new Date().toISOString();
      const effectiveDate = budgetDateKey(now);
      if (currentHousehold.baseCurrency !== currency) {
        let factor: number;
        try {
          factor = await exchangeRate(currentHousehold.baseCurrency, currency);
        } catch {
          return secureJson(
            { error: "Currency conversion is temporarily unavailable" },
            { status: 503 },
          );
        }
        await db.batch([
          db
            .update(transactions)
            .set({
              baseAmountCents: sql`CAST(round(${transactions.baseAmountCents} * ${factor}) AS INTEGER)`,
            })
            .where(eq(transactions.householdId, member.householdId)),
          db
            .update(householdDailyBudgets)
            .set({
              dailyBudgetCents: sql`CAST(round(${householdDailyBudgets.dailyBudgetCents} * ${factor}) AS INTEGER)`,
            })
            .where(eq(householdDailyBudgets.householdId, member.householdId)),
          db
            .update(householdMonthlyBudgets)
            .set({
              adjustmentCents: sql`CAST(round(${householdMonthlyBudgets.adjustmentCents} * ${factor}) AS INTEGER)`,
            })
            .where(eq(householdMonthlyBudgets.householdId, member.householdId)),
          db
            .update(households)
            .set({
              budgetAdjustmentCents: sql`CAST(round(${households.budgetAdjustmentCents} * ${factor}) AS INTEGER)`,
            })
            .where(eq(households.id, member.householdId)),
        ]);
      }

      const dailyBudgetCents = Math.round(amount * 100);
      await db.batch([
        db
          .insert(householdDailyBudgets)
          .values({
            id: crypto.randomUUID(),
            householdId: member.householdId,
            effectiveDate,
            dailyBudgetCents,
            createdAt: now,
          })
          .onConflictDoUpdate({
            target: [
              householdDailyBudgets.householdId,
              householdDailyBudgets.effectiveDate,
            ],
            set: { dailyBudgetCents, createdAt: now },
          }),
        db
          .update(households)
          .set({ baseCurrency: currency, setupCompletedAt: now })
          .where(eq(households.id, member.householdId)),
      ]);
      await writeAudit({
        householdId: member.householdId,
        actorMemberId: member.id,
        action: "budget.daily_settings_updated",
        entityType: "household",
        entityId: member.householdId,
        summary: `Set daily budget to ${currency} ${amount.toFixed(2)} from ${effectiveDate}`,
      });
      return secureJson(await dashboardPayload(db, member));
    }

    if (body.action === "approveMembershipRequest") {
      return secureJson(
        { error: "Member voting is no longer used" },
        { status: 410 },
      );
    }

    if (body.action === "rotateTelegramLink") {
      const requestedId = String(body.targetMemberId ?? member.id);
      if (requestedId !== member.id)
        return secureJson(
          { error: "You can only create your own Telegram link" },
          { status: 403 },
        );
      const [targetMember] = await db
        .select()
        .from(members)
        .where(
          and(
            eq(members.id, requestedId),
            eq(members.householdId, member.householdId),
            eq(members.status, "active"),
          ),
        )
        .limit(1);
      if (!targetMember)
        return secureJson(
          { error: "Active member not found" },
          { status: 404 },
        );
      const nextCode = code();
      const expiresAt = linkExpiry();
      await db
        .update(members)
        .set({
          telegramLinkCode: nextCode,
          telegramLinkCodeExpiresAt: expiresAt,
        })
        .where(eq(members.id, targetMember.id));
      await writeAudit({
        householdId: member.householdId,
        actorMemberId: member.id,
        action: "telegram.link_rotated",
        entityType: "member",
        entityId: targetMember.id,
        summary: `Generated a new one-time Telegram link for ${targetMember.name}`,
      });
      const payload = await dashboardPayload(db, member);
      return secureJson(payload);
    }

    if (body.action === "updateProfileName") {
      const name = String(body.name ?? "")
        .trim()
        .replace(/\s+/g, " ");
      if (
        name.length < 2 ||
        name.length > 80 ||
        !/^[\p{L}\p{N}][\p{L}\p{N} .,'’\-]*$/u.test(name)
      ) {
        return secureJson(
          { error: "Use a name of 2–80 letters or numbers" },
          { status: 400 },
        );
      }
      const nameKey = normalizeName(name);
      const [duplicate] = await db
        .select({ id: members.id })
        .from(members)
        .where(
          and(
            eq(members.householdId, member.householdId),
            eq(members.status, "active"),
            ne(members.id, member.id),
            eq(members.nameKey, nameKey),
          ),
        )
        .limit(1);
      if (duplicate)
        return secureJson(
          { error: "That name is already used in this household" },
          { status: 409 },
        );
      await db
        .update(members)
        .set({ name, nameKey })
        .where(eq(members.id, member.id));
      await writeAudit({
        householdId: member.householdId,
        actorMemberId: member.id,
        action: "profile.renamed",
        entityType: "member",
        entityId: member.id,
        summary: `Changed profile name to ${name}`,
      });
      const [updatedMember] = await db
        .select()
        .from(members)
        .where(eq(members.id, member.id))
        .limit(1);
      return secureJson(await dashboardPayload(db, updatedMember ?? member));
    }

    if (body.action === "addCategory") {
      const name = String(body.name ?? "")
        .trim()
        .replace(/\s+/g, " ");
      const nameKey = normalizeName(name);
      if (
        name.length < 2 ||
        name.length > 30 ||
        !/^[\p{L}\p{N}][\p{L}\p{N} &'’+\-/]*$/u.test(name)
      ) {
        return secureJson(
          { error: "Use a short category name of 2–30 letters or numbers" },
          { status: 400 },
        );
      }
      if (allowedCategories.some((item) => normalizeName(item) === nameKey))
        return secureJson(
          { error: "That category already exists" },
          { status: 409 },
        );
      const [existingCategory] = await db
        .select()
        .from(expenseCategories)
        .where(
          and(
            eq(expenseCategories.householdId, member.householdId),
            eq(expenseCategories.nameKey, nameKey),
          ),
        )
        .limit(1);
      if (existingCategory) {
        if (!existingCategory.archivedAt)
          return secureJson(
            { error: "That category already exists" },
            { status: 409 },
          );
        await db
          .update(expenseCategories)
          .set({ name, archivedAt: null })
          .where(eq(expenseCategories.id, existingCategory.id));
        await writeAudit({
          householdId: member.householdId,
          actorMemberId: member.id,
          action: "category.restored",
          entityType: "category",
          entityId: existingCategory.id,
          summary: `Restored category ${name}`,
        });
        return secureJson(await dashboardPayload(db, member));
      }
      const id = crypto.randomUUID();
      const inserted = await db
        .insert(expenseCategories)
        .values({
          id,
          householdId: member.householdId,
          name,
          nameKey,
          createdByMemberId: member.id,
          createdAt: new Date().toISOString(),
        })
        .onConflictDoNothing()
        .returning({ id: expenseCategories.id });
      if (!inserted.length)
        return secureJson(
          { error: "That category already exists" },
          { status: 409 },
        );
      await writeAudit({
        householdId: member.householdId,
        actorMemberId: member.id,
        action: "category.created",
        entityType: "category",
        entityId: id,
        summary: `Created category ${name}`,
      });
      return secureJson(await dashboardPayload(db, member), { status: 201 });
    }

    if (body.action === "archiveCategory") {
      const categoryId = String(body.categoryId ?? "");
      const [category] = await db
        .select()
        .from(expenseCategories)
        .where(
          and(
            eq(expenseCategories.id, categoryId),
            eq(expenseCategories.householdId, member.householdId),
            isNull(expenseCategories.archivedAt),
          ),
        )
        .limit(1);
      if (!category)
        return secureJson({ error: "Category not found" }, { status: 404 });
      await db
        .update(expenseCategories)
        .set({ archivedAt: new Date().toISOString() })
        .where(eq(expenseCategories.id, category.id));
      await writeAudit({
        householdId: member.householdId,
        actorMemberId: member.id,
        action: "category.archived",
        entityType: "category",
        entityId: category.id,
        summary: `Archived category ${category.name}`,
      });
      return secureJson(await dashboardPayload(db, member));
    }

    if (body.action === "resetTransactions") {
      if (body.confirmation !== "RESET")
        return secureJson(
          { error: "Reset confirmation is required" },
          { status: 400 },
        );
      const now = new Date().toISOString();
      await db
        .update(transactions)
        .set({ deletedAt: now, updatedAt: now })
        .where(
          and(
            eq(transactions.householdId, member.householdId),
            eq(transactions.memberId, member.id),
            isNull(transactions.deletedAt),
          ),
        );
      await writeAudit({
        householdId: member.householdId,
        actorMemberId: member.id,
        action: "transactions.reset",
        entityType: "member",
        entityId: member.id,
        summary: "Reset own expenses",
      });
      return secureJson(await dashboardPayload(db, member));
    }

    if (body.action === "addTransaction") {
      const amount = Number(body.amount);
      const category = String(body.category ?? "Other").trim();
      const note = String(body.note ?? "Expense").trim();
      const currency = String(body.currency ?? "EUR").toUpperCase();
      const type = body.type === "income" ? "income" : "expense";
      if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
        return Response.json(
          { error: "Amount must be greater than zero" },
          { status: 400 },
        );
      }
      const [customCategory] = await db
        .select({ id: expenseCategories.id })
        .from(expenseCategories)
        .where(
          and(
            eq(expenseCategories.householdId, member.householdId),
            eq(expenseCategories.nameKey, normalizeName(category)),
            isNull(expenseCategories.archivedAt),
          ),
        )
        .limit(1);
      if (
        (!allowedCategories.includes(category) && !customCategory) ||
        note.length > 200
      ) {
        return Response.json(
          { error: "Invalid category or note" },
          { status: 400 },
        );
      }
      if (!(supportedCurrencies as readonly string[]).includes(currency)) {
        return Response.json(
          { error: "Unsupported currency" },
          { status: 400 },
        );
      }

      const [household] = await db
        .select({ baseCurrency: households.baseCurrency })
        .from(households)
        .where(eq(households.id, member.householdId))
        .limit(1);
      const baseCurrency = household?.baseCurrency ?? "EUR";
      let amountInBase = amount;
      if (currency !== baseCurrency) {
        try {
          amountInBase = amount * (await exchangeRate(currency, baseCurrency));
        } catch {
          const fallbackRate = Number(body.baseRate);
          if (
            !Number.isFinite(fallbackRate) ||
            fallbackRate <= 0 ||
            fallbackRate > 10
          ) {
            return Response.json(
              { error: "Currency conversion is temporarily unavailable" },
              { status: 503 },
            );
          }
          amountInBase = amount * fallbackRate;
        }
      }

      const happenedAt = safeIsoDate(body.happenedAt);
      if (!happenedAt)
        return secureJson({ error: "Invalid expense date" }, { status: 400 });
      const item = {
        id: crypto.randomUUID(),
        householdId: member.householdId,
        memberId: member.id,
        amountCents: Math.round(amount * 100),
        baseAmountCents: Math.round(amountInBase * 100),
        currency,
        category,
        note: note || category,
        type,
        source: "web",
        happenedAt,
        createdAt: new Date().toISOString(),
      };
      await db.insert(transactions).values(item);
      await writeAudit({
        householdId: member.householdId,
        actorMemberId: member.id,
        action: "transaction.created",
        entityType: "transaction",
        entityId: item.id,
        summary: `Added ${currency} ${amount.toFixed(2)} in ${category}`,
      });
      return secureJson({ transaction: item }, { status: 201 });
    }

    if (body.action === "updateTransaction") {
      const transactionId = String(body.transactionId ?? "");
      const [existing] = await db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.id, transactionId),
            eq(transactions.householdId, member.householdId),
            eq(transactions.memberId, member.id),
            isNull(transactions.deletedAt),
          ),
        )
        .limit(1);
      if (!existing)
        return secureJson(
          { error: "You can only edit your own active expenses" },
          { status: 404 },
        );
      const amount = Number(body.amount);
      const category = String(body.category ?? existing.category).trim();
      const note = String(body.note ?? existing.note).trim();
      if (
        !Number.isFinite(amount) ||
        amount <= 0 ||
        amount > 1_000_000_000 ||
        note.length > 200
      )
        return secureJson(
          { error: "Invalid expense details" },
          { status: 400 },
        );
      const [customCategory] = await db
        .select({ id: expenseCategories.id })
        .from(expenseCategories)
        .where(
          and(
            eq(expenseCategories.householdId, member.householdId),
            eq(expenseCategories.nameKey, normalizeName(category)),
            isNull(expenseCategories.archivedAt),
          ),
        )
        .limit(1);
      if (!allowedCategories.includes(category) && !customCategory)
        return secureJson({ error: "Invalid category" }, { status: 400 });
      const amountCents = Math.round(amount * 100);
      const ratio =
        existing.amountCents > 0
          ? existing.baseAmountCents / existing.amountCents
          : 1;
      const updatedAt = new Date().toISOString();
      await db
        .update(transactions)
        .set({
          amountCents,
          baseAmountCents: Math.round(amountCents * ratio),
          category,
          note: note || category,
          updatedAt,
        })
        .where(eq(transactions.id, existing.id));
      await writeAudit({
        householdId: member.householdId,
        actorMemberId: member.id,
        action: "transaction.updated",
        entityType: "transaction",
        entityId: existing.id,
        summary: `Updated expense to ${existing.currency} ${amount.toFixed(2)} in ${category}`,
      });
      const [updated] = await db
        .select()
        .from(transactions)
        .where(eq(transactions.id, existing.id))
        .limit(1);
      return secureJson({ transaction: updated });
    }

    if (body.action === "deleteTransaction") {
      const transactionId = String(body.transactionId ?? "");
      const [existing] = await db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.id, transactionId),
            eq(transactions.householdId, member.householdId),
            isNull(transactions.deletedAt),
          ),
        )
        .limit(1);
      if (
        !existing ||
        (member.role !== "owner" && existing.memberId !== member.id)
      )
        return secureJson(
          {
            error:
              "Only the household owner or the member who created this expense can delete it",
          },
          { status: 404 },
        );
      await db
        .update(transactions)
        .set({
          deletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(transactions.id, existing.id));
      await writeAudit({
        householdId: member.householdId,
        actorMemberId: member.id,
        action: "transaction.deleted",
        entityType: "transaction",
        entityId: existing.id,
        summary: `Deleted ${existing.currency} ${(existing.amountCents / 100).toFixed(2)} in ${existing.category}`,
      });
      return secureJson({ ok: true, transactionId: existing.id });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    if (error instanceof HttpError)
      return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "Unable to save" }, { status: 500 });
  }
}
