import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  households,
  auditLogs,
  expenseCategories,
  members,
  membershipApprovals,
  membershipRequests,
  telegramLinks,
  transactions,
} from "../../../db/schema";
import { requestIdentity } from "../../../lib/server-auth";
import { enforceRateLimit, safeIsoDate, sameOrigin, secureJson, writeAudit } from "../../../lib/security";

export const dynamic = "force-dynamic";

const palette = ["#1d6b5a", "#e2764f", "#8b6ccf", "#d5a634", "#4076b9"];
const allowedCategories = ["Groceries", "Dining", "Transport", "Home", "Health", "Leisure", "Bills", "Other"];

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function code() {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase();
}

function linkExpiry() { return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); }

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

async function currentMember(request: Request) {
  const identity = requestIdentity(request);
  if (!identity) return null;
  const db = await getDb();
  const existing = await db
    .select()
    .from(members)
    .where(eq(members.email, identity.email))
    .limit(1);
  if (existing[0]) return existing[0].status === "active" ? existing[0] : null;

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
    db.insert(members).values({
      id: memberId,
      householdId,
      email: identity.email,
      name: identity.name,
      nameKey: normalizeName(identity.name),
      color: palette[0],
      role: "owner",
      status: "active",
      telegramLinkCode: code(),
      telegramLinkCodeExpiresAt: linkExpiry(),
      createdAt: now,
    }),
  ]);
  const created = await db.select().from(members).where(eq(members.id, memberId)).limit(1);
  return created[0];
}

async function dashboardPayload(db: Awaited<ReturnType<typeof getDb>>, member: typeof members.$inferSelect) {
  const [household] = await db
    .select()
    .from(households)
    .where(eq(households.id, member.householdId))
    .limit(1);
  const family = await db
    .select()
    .from(members)
    .where(eq(members.householdId, member.householdId));
  const activity = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.householdId, member.householdId), isNull(transactions.deletedAt)))
    .orderBy(desc(transactions.happenedAt))
    .limit(300);
  const pending = await db
    .select()
    .from(membershipRequests)
    .where(and(
      eq(membershipRequests.householdId, member.householdId),
      eq(membershipRequests.status, "pending"),
    ))
    .orderBy(desc(membershipRequests.createdAt));
  const approvals = pending.length
    ? await db
        .select()
        .from(membershipApprovals)
        .where(inArray(membershipApprovals.requestId, pending.map((item) => item.id)))
    : [];
  const names = new Map(family.map((item) => [item.id, item.name]));
  const customCategories = await db.select().from(expenseCategories)
    .where(and(eq(expenseCategories.householdId, member.householdId), isNull(expenseCategories.archivedAt)))
    .orderBy(expenseCategories.name);
  const recentAudit = await db.select().from(auditLogs)
    .where(eq(auditLogs.householdId, member.householdId))
    .orderBy(desc(auditLogs.createdAt)).limit(40);

  return {
    household,
    currentMemberId: member.id,
    members: family,
    transactions: activity,
    membershipRequests: pending.map((item) => {
      const requestApprovals = approvals.filter((approval) => approval.requestId === item.id);
      return {
        id: item.id,
        action: item.action,
        targetMemberId: item.targetMemberId,
        targetName: item.targetName,
        targetEmail: item.targetEmail,
        requestedByName: names.get(item.requestedByMemberId) ?? "Member",
        approvals: requestApprovals.length,
        requiredApprovals: item.requiredApprovals,
        currentMemberApproved: requestApprovals.some((approval) => approval.memberId === member.id),
        canApprove: member.status === "active" && (item.action !== "remove" || item.targetMemberId !== member.id),
        createdAt: item.createdAt,
      };
    }),
    categories: customCategories.map((item) => ({ id: item.id, name: item.name })),
    auditLogs: recentAudit.map((item) => ({ ...item, actorName: item.actorMemberId ? names.get(item.actorMemberId) ?? "Former member" : "System" })),
  };
}

async function activeFamily(db: Awaited<ReturnType<typeof getDb>>, householdId: string) {
  return db
    .select()
    .from(members)
    .where(and(eq(members.householdId, householdId), eq(members.status, "active")));
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
    .where(and(
      eq(members.householdId, householdId),
      eq(members.status, "active"),
      sql`lower(trim(${members.name})) = ${nameKey}`,
    ))
    .limit(1);
  if (duplicateName[0]) throw new HttpError(409, "A member with that name already exists in this household");

  const duplicateEmail = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.email, email), eq(members.status, "active")))
    .limit(1);
  if (duplicateEmail[0]) throw new HttpError(409, "That email already belongs to an active household member");

  return nameKey;
}

async function approvalCount(db: Awaited<ReturnType<typeof getDb>>, requestId: string) {
  const rows = await db
    .select({ id: membershipApprovals.id })
    .from(membershipApprovals)
    .where(eq(membershipApprovals.requestId, requestId));
  return rows.length;
}

async function finalizeRequest(
  db: Awaited<ReturnType<typeof getDb>>,
  requestRow: typeof membershipRequests.$inferSelect,
) {
  if (requestRow.status !== "pending") return;
  const approvals = await approvalCount(db, requestRow.id);
  if (approvals < requestRow.requiredApprovals) return;
  const now = new Date().toISOString();

  if (requestRow.action === "add") {
    const nameKey = await ensureUniqueMember(
      db,
      requestRow.householdId,
      requestRow.targetName,
      requestRow.targetEmail,
    );
    const family = await activeFamily(db, requestRow.householdId);
    await db.insert(members).values({
      id: requestRow.targetMemberId,
      householdId: requestRow.householdId,
      name: requestRow.targetName,
      nameKey,
      email: requestRow.targetEmail,
      color: palette[family.length % palette.length],
      role: "member",
      status: "active",
      telegramLinkCode: code(),
      telegramLinkCodeExpiresAt: linkExpiry(),
      createdAt: now,
    });
  } else {
    const [target] = await db
      .select()
      .from(members)
      .where(and(
        eq(members.id, requestRow.targetMemberId),
        eq(members.householdId, requestRow.householdId),
        eq(members.status, "active"),
      ))
      .limit(1);
    if (target) {
      await db.batch([
        db.update(members).set({ status: "removed", removedAt: now, nameKey: null }).where(eq(members.id, target.id)),
        db.delete(telegramLinks).where(eq(telegramLinks.memberId, target.id)),
      ]);
      if (target.role === "owner") {
        const [successor] = await db
          .select()
          .from(members)
          .where(and(
            eq(members.householdId, requestRow.householdId),
            eq(members.status, "active"),
            ne(members.id, target.id),
          ))
          .orderBy(members.createdAt)
          .limit(1);
        if (successor) await db.update(members).set({ role: "owner" }).where(eq(members.id, successor.id));
      }
    }
  }

  await db
    .update(membershipRequests)
    .set({ status: "approved", resolvedAt: now })
    .where(and(eq(membershipRequests.id, requestRow.id), eq(membershipRequests.status, "pending")));
}

export async function GET(request: Request) {
  try {
    const member = await currentMember(request);
    if (!member) return Response.json({ error: "Sign in required" }, { status: 401 });

    const db = await getDb();
    return secureJson(await dashboardPayload(db, member));
  } catch {
    return Response.json({ error: "Unable to load dashboard" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return secureJson({ error: "Cross-site requests are not allowed" }, { status: 403 });
    const member = await currentMember(request);
    if (!member) return Response.json({ error: "Sign in required" }, { status: 401 });
    const rate = await enforceRateLimit(`dashboard:${member.id}`, 45);
    if (!rate.allowed) return secureJson({ error: "Too many requests. Please wait a moment." }, { status: 429, headers: { "retry-after": String(rate.retryAfter) } });
    const body = (await request.json()) as Record<string, unknown>;
    const db = await getDb();

    if (body.action === "requestAddMember") {
      const name = String(body.name ?? "").trim();
      const email = String(body.email ?? "").trim().toLowerCase();
      if (!name || name.length > 80 || email.length > 254 || !email.includes("@")) {
        return Response.json({ error: "A name and valid email are required" }, { status: 400 });
      }
      await ensureUniqueMember(db, member.householdId, name, email);
      const [openChange] = await db
        .select({ id: membershipRequests.id })
        .from(membershipRequests)
        .where(and(
          eq(membershipRequests.householdId, member.householdId),
          eq(membershipRequests.status, "pending"),
        ))
        .limit(1);
      if (openChange) return Response.json({ error: "Finish the pending member change before starting another" }, { status: 409 });
      const family = await activeFamily(db, member.householdId);
      const now = new Date().toISOString();
      const requestRow = {
        id: crypto.randomUUID(),
        householdId: member.householdId,
        action: "add",
        targetMemberId: crypto.randomUUID(),
        targetName: name,
        targetEmail: email,
        requestedByMemberId: member.id,
        requiredApprovals: Math.max(1, family.length - 1),
        status: "pending",
        createdAt: now,
        resolvedAt: null,
      };
      await db.batch([
        db.insert(membershipRequests).values(requestRow),
        db.insert(membershipApprovals).values({ id: crypto.randomUUID(), requestId: requestRow.id, memberId: member.id, createdAt: now }),
      ]);
      await writeAudit({ householdId: member.householdId, actorMemberId: member.id, action: "member.add_requested", entityType: "member", entityId: requestRow.targetMemberId, summary: `Requested to add ${name}` });
      await finalizeRequest(db, requestRow);
      return Response.json(await dashboardPayload(db, member), { status: 201 });
    }

    if (body.action === "requestRemoveMember") {
      const targetMemberId = String(body.targetMemberId ?? "");
      if (!targetMemberId || targetMemberId === member.id) {
        return Response.json({ error: "You cannot remove your own account" }, { status: 400 });
      }
      const family = await activeFamily(db, member.householdId);
      const target = family.find((item) => item.id === targetMemberId);
      if (!target) return Response.json({ error: "Active member not found" }, { status: 404 });
      if (family.length <= 1) return Response.json({ error: "A household must keep at least one member" }, { status: 400 });
      const [openChange] = await db
        .select({ id: membershipRequests.id })
        .from(membershipRequests)
        .where(and(
          eq(membershipRequests.householdId, member.householdId),
          eq(membershipRequests.status, "pending"),
        ))
        .limit(1);
      if (openChange) return Response.json({ error: "Finish the pending member change before starting another" }, { status: 409 });
      const now = new Date().toISOString();
      const requestRow = {
        id: crypto.randomUUID(),
        householdId: member.householdId,
        action: "remove",
        targetMemberId: target.id,
        targetName: target.name,
        targetEmail: target.email,
        requestedByMemberId: member.id,
        requiredApprovals: family.length - 1,
        status: "pending",
        createdAt: now,
        resolvedAt: null,
      };
      await db.batch([
        db.insert(membershipRequests).values(requestRow),
        db.insert(membershipApprovals).values({ id: crypto.randomUUID(), requestId: requestRow.id, memberId: member.id, createdAt: now }),
      ]);
      await writeAudit({ householdId: member.householdId, actorMemberId: member.id, action: "member.remove_requested", entityType: "member", entityId: target.id, summary: `Requested to remove ${target.name}` });
      await finalizeRequest(db, requestRow);
      return Response.json(await dashboardPayload(db, member), { status: 201 });
    }

    if (body.action === "approveMembershipRequest") {
      const requestId = String(body.requestId ?? "");
      const [requestRow] = await db
        .select()
        .from(membershipRequests)
        .where(and(
          eq(membershipRequests.id, requestId),
          eq(membershipRequests.householdId, member.householdId),
          eq(membershipRequests.status, "pending"),
        ))
        .limit(1);
      if (!requestRow) return Response.json({ error: "Pending request not found" }, { status: 404 });
      if (requestRow.action === "remove" && requestRow.targetMemberId === member.id) {
        return Response.json({ error: "The member being removed cannot approve the request" }, { status: 403 });
      }
      await db.insert(membershipApprovals).values({
        id: crypto.randomUUID(),
        requestId: requestRow.id,
        memberId: member.id,
        createdAt: new Date().toISOString(),
      }).onConflictDoNothing();
      await writeAudit({ householdId: member.householdId, actorMemberId: member.id, action: "membership.approved", entityType: "membership_request", entityId: requestRow.id, summary: `Approved ${requestRow.action} request for ${requestRow.targetName}` });
      await finalizeRequest(db, requestRow);
      return Response.json(await dashboardPayload(db, member));
    }

    if (body.action === "rotateTelegramLink") {
      const requestedId = String(body.targetMemberId ?? member.id);
      if (requestedId !== member.id && member.role !== "owner") return secureJson({ error: "Only the household owner can create another member's link" }, { status: 403 });
      const [targetMember] = await db.select().from(members).where(and(eq(members.id, requestedId), eq(members.householdId, member.householdId), eq(members.status, "active"))).limit(1);
      if (!targetMember) return secureJson({ error: "Active member not found" }, { status: 404 });
      const nextCode = code();
      const expiresAt = linkExpiry();
      await db.update(members).set({ telegramLinkCode: nextCode, telegramLinkCodeExpiresAt: expiresAt }).where(eq(members.id, targetMember.id));
      await writeAudit({ householdId: member.householdId, actorMemberId: member.id, action: "telegram.link_rotated", entityType: "member", entityId: targetMember.id, summary: `Generated a new one-time Telegram link for ${targetMember.name}` });
      const payload = await dashboardPayload(db, member);
      return secureJson(payload);
    }

    if (body.action === "addCategory") {
      const name = String(body.name ?? "").trim().replace(/\s+/g, " ");
      const nameKey = normalizeName(name);
      if (name.length < 2 || name.length > 30 || !/^[\p{L}\p{N}][\p{L}\p{N} &'’+\-/]*$/u.test(name)) {
        return secureJson({ error: "Use a short category name of 2–30 letters or numbers" }, { status: 400 });
      }
      if (allowedCategories.some((item) => normalizeName(item) === nameKey)) return secureJson({ error: "That category already exists" }, { status: 409 });
      const [existingCategory] = await db.select().from(expenseCategories).where(and(eq(expenseCategories.householdId, member.householdId), eq(expenseCategories.nameKey, nameKey))).limit(1);
      if (existingCategory) {
        if (!existingCategory.archivedAt) return secureJson({ error: "That category already exists" }, { status: 409 });
        await db.update(expenseCategories).set({ name, archivedAt: null }).where(eq(expenseCategories.id, existingCategory.id));
        await writeAudit({ householdId: member.householdId, actorMemberId: member.id, action: "category.restored", entityType: "category", entityId: existingCategory.id, summary: `Restored category ${name}` });
        return secureJson(await dashboardPayload(db, member));
      }
      const id = crypto.randomUUID();
      const inserted = await db.insert(expenseCategories).values({ id, householdId: member.householdId, name, nameKey, createdByMemberId: member.id, createdAt: new Date().toISOString() })
        .onConflictDoNothing().returning({ id: expenseCategories.id });
      if (!inserted.length) return secureJson({ error: "That category already exists" }, { status: 409 });
      await writeAudit({ householdId: member.householdId, actorMemberId: member.id, action: "category.created", entityType: "category", entityId: id, summary: `Created category ${name}` });
      return secureJson(await dashboardPayload(db, member), { status: 201 });
    }

    if (body.action === "archiveCategory") {
      const categoryId = String(body.categoryId ?? "");
      const [category] = await db.select().from(expenseCategories).where(and(eq(expenseCategories.id, categoryId), eq(expenseCategories.householdId, member.householdId), isNull(expenseCategories.archivedAt))).limit(1);
      if (!category) return secureJson({ error: "Category not found" }, { status: 404 });
      await db.update(expenseCategories).set({ archivedAt: new Date().toISOString() }).where(eq(expenseCategories.id, category.id));
      await writeAudit({ householdId: member.householdId, actorMemberId: member.id, action: "category.archived", entityType: "category", entityId: category.id, summary: `Archived category ${category.name}` });
      return secureJson(await dashboardPayload(db, member));
    }

    if (body.action === "addTransaction") {
      const amount = Number(body.amount);
      const category = String(body.category ?? "Other").trim();
      const note = String(body.note ?? "Expense").trim();
      const currency = String(body.currency ?? "EUR").toUpperCase();
      const type = body.type === "income" ? "income" : "expense";
      const supportedCurrencies = ["EUR", "USD", "CAD", "GBP"];
      if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
        return Response.json({ error: "Amount must be greater than zero" }, { status: 400 });
      }
      const [customCategory] = await db.select({ id: expenseCategories.id }).from(expenseCategories)
        .where(and(eq(expenseCategories.householdId, member.householdId), eq(expenseCategories.nameKey, normalizeName(category)), isNull(expenseCategories.archivedAt))).limit(1);
      if ((!allowedCategories.includes(category) && !customCategory) || note.length > 200) {
        return Response.json({ error: "Invalid category or note" }, { status: 400 });
      }
      if (!supportedCurrencies.includes(currency)) {
        return Response.json({ error: "Unsupported currency" }, { status: 400 });
      }

      let amountInEuro = amount;
      if (currency !== "EUR") {
        try {
          const rateResponse = await fetch(
            `https://api.frankfurter.dev/v2/rates?base=${currency}&quotes=EUR`,
          );
          const rateRows = (await rateResponse.json()) as Array<{ quote: string; rate: number }>;
          const rate = rateRows.find((row) => row.quote === "EUR")?.rate;
          if (!rate || !Number.isFinite(rate)) throw new Error("Rate unavailable");
          amountInEuro = amount * rate;
        } catch {
          const fallbackRate = Number(body.eurRate);
          if (!Number.isFinite(fallbackRate) || fallbackRate <= 0 || fallbackRate > 10) {
            return Response.json({ error: "Currency conversion is temporarily unavailable" }, { status: 503 });
          }
          amountInEuro = amount * fallbackRate;
        }
      }

      const happenedAt = safeIsoDate(body.happenedAt);
      if (!happenedAt) return secureJson({ error: "Invalid expense date" }, { status: 400 });
      const item = {
        id: crypto.randomUUID(),
        householdId: member.householdId,
        memberId: member.id,
        amountCents: Math.round(amount * 100),
        baseAmountCents: Math.round(amountInEuro * 100),
        currency,
        category,
        note: note || category,
        type,
        source: "web",
        happenedAt,
        createdAt: new Date().toISOString(),
      };
      await db.insert(transactions).values(item);
      await writeAudit({ householdId: member.householdId, actorMemberId: member.id, action: "transaction.created", entityType: "transaction", entityId: item.id, summary: `Added ${currency} ${amount.toFixed(2)} in ${category}` });
      return secureJson({ transaction: item }, { status: 201 });
    }

    if (body.action === "updateTransaction") {
      const transactionId = String(body.transactionId ?? "");
      const [existing] = await db.select().from(transactions).where(and(eq(transactions.id, transactionId), eq(transactions.householdId, member.householdId), eq(transactions.memberId, member.id), isNull(transactions.deletedAt))).limit(1);
      if (!existing) return secureJson({ error: "You can only edit your own active expenses" }, { status: 404 });
      const amount = Number(body.amount);
      const category = String(body.category ?? existing.category).trim();
      const note = String(body.note ?? existing.note).trim();
      if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000 || note.length > 200) return secureJson({ error: "Invalid expense details" }, { status: 400 });
      const [customCategory] = await db.select({ id: expenseCategories.id }).from(expenseCategories)
        .where(and(eq(expenseCategories.householdId, member.householdId), eq(expenseCategories.nameKey, normalizeName(category)), isNull(expenseCategories.archivedAt))).limit(1);
      if (!allowedCategories.includes(category) && !customCategory) return secureJson({ error: "Invalid category" }, { status: 400 });
      const amountCents = Math.round(amount * 100);
      const ratio = existing.amountCents > 0 ? existing.baseAmountCents / existing.amountCents : 1;
      const updatedAt = new Date().toISOString();
      await db.update(transactions).set({ amountCents, baseAmountCents: Math.round(amountCents * ratio), category, note: note || category, updatedAt }).where(eq(transactions.id, existing.id));
      await writeAudit({ householdId: member.householdId, actorMemberId: member.id, action: "transaction.updated", entityType: "transaction", entityId: existing.id, summary: `Updated expense to ${existing.currency} ${amount.toFixed(2)} in ${category}` });
      const [updated] = await db.select().from(transactions).where(eq(transactions.id, existing.id)).limit(1);
      return secureJson({ transaction: updated });
    }

    if (body.action === "deleteTransaction") {
      const transactionId = String(body.transactionId ?? "");
      const [existing] = await db.select().from(transactions).where(and(eq(transactions.id, transactionId), eq(transactions.householdId, member.householdId), eq(transactions.memberId, member.id), isNull(transactions.deletedAt))).limit(1);
      if (!existing) return secureJson({ error: "You can only delete your own active expenses" }, { status: 404 });
      await db.update(transactions).set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(transactions.id, existing.id));
      await writeAudit({ householdId: member.householdId, actorMemberId: member.id, action: "transaction.deleted", entityType: "transaction", entityId: existing.id, summary: `Deleted ${existing.currency} ${(existing.amountCents / 100).toFixed(2)} in ${existing.category}` });
      return secureJson({ ok: true, transactionId: existing.id });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "Unable to save" }, { status: 500 });
  }
}
