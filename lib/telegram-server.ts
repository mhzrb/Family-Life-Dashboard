import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { expenseCategories, members, telegramBotState, telegramConversationState, telegramLinks, transactions } from "../db/schema";
import { enforceRateLimit, writeAudit } from "./security";
import { budgetTelegramText, calculateBudgetStatus } from "./budget";

export type TelegramUpdate = {
  update_id: number;
  message?: {
    chat: { id: number };
    text?: string;
  };
  callback_query?: {
    id: string;
    data?: string;
    message?: { chat: { id: number } };
  };
};

const knownCategories = ["Groceries", "Dining", "Transport", "Home", "Health", "Leisure", "Bills", "Other"];

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

async function token() {
  const { env } = await import("cloudflare:workers");
  return (env as unknown as Record<string, string | undefined>).TELEGRAM_BOT_TOKEN;
}

const mainMenu = { keyboard: [[{ text: "➕ Add expense" }, { text: "📊 Budget status" }]], resize_keyboard: true, is_persistent: true };
const standardCategoryButtons = [
  { text: "🛒 Groceries", callback_data: "category:Groceries" },
  { text: "☕ Dining", callback_data: "category:Dining" },
  { text: "🚆 Transport", callback_data: "category:Transport" },
  { text: "🏠 Home", callback_data: "category:Home" },
  { text: "❤️ Health", callback_data: "category:Health" },
  { text: "✨ Leisure", callback_data: "category:Leisure" },
  { text: "🧾 Bills", callback_data: "category:Bills" },
];

function normalizedCategoryName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function categoryNameKey(value: string) {
  return normalizedCategoryName(value).toLocaleLowerCase("en-US");
}

async function categoryMenu(householdId: string) {
  const db = await getDb();
  const custom = await db.select({ id: expenseCategories.id, name: expenseCategories.name })
    .from(expenseCategories).where(and(eq(expenseCategories.householdId, householdId), isNull(expenseCategories.archivedAt)));
  const buttons = [
    ...standardCategoryButtons,
    ...custom.sort((a, b) => a.name.localeCompare(b.name)).map((item) => ({
      text: `• ${item.name}`,
      callback_data: `custom_category:${item.id}`,
    })),
    { text: "••• Other", callback_data: "category:Other" },
  ];
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  for (let index = 0; index < buttons.length; index += 2) rows.push(buttons.slice(index, index + 2));
  return { inline_keyboard: rows };
}

export async function replyToTelegram(chatId: string, text: string, replyMarkup?: Record<string, unknown>) {
  const botToken = await token();
  if (!botToken) return;
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, ...(replyMarkup ? { reply_markup: replyMarkup } : {}) }),
  });
}

async function answerCallback(callbackId: string, text?: string) {
  const botToken = await token();
  if (!botToken) return;
  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackId, ...(text ? { text } : {}) }),
  });
}

async function activeLink(chatId: string) {
  const db = await getDb();
  const [link] = await db.select().from(telegramLinks).where(eq(telegramLinks.chatId, chatId)).limit(1);
  if (!link) return null;
  const [member] = await db.select({ id: members.id, name: members.name }).from(members)
    .where(and(eq(members.id, link.memberId), eq(members.status, "active"))).limit(1);
  if (!member) {
    await db.delete(telegramLinks).where(eq(telegramLinks.chatId, chatId));
    return null;
  }
  return { link, member };
}

async function householdBudgetText(householdId: string) {
  const db = await getDb();
  const items = await db.select({ type: transactions.type, baseAmountCents: transactions.baseAmountCents, happenedAt: transactions.happenedAt })
    .from(transactions).where(and(eq(transactions.householdId, householdId), isNull(transactions.deletedAt)));
  return budgetTelegramText(calculateBudgetStatus(items as Array<{ type: "expense" | "income"; baseAmountCents: number; happenedAt: string }>));
}

async function saveExpense(updateId: number, chatId: string, category: string, amount: number) {
  const linked = await activeLink(chatId);
  if (!linked) return false;
  const db = await getDb();
  const amountCents = Math.round(amount * 100);
  const inserted = await db.insert(transactions).values({
    id: crypto.randomUUID(), householdId: linked.link.householdId, memberId: linked.link.memberId,
    amountCents, baseAmountCents: amountCents, currency: "EUR", category, note: category,
    type: "expense", source: "telegram", telegramUpdateId: String(updateId),
    happenedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
  }).onConflictDoNothing().returning({ id: transactions.id });
  if (inserted.length) await writeAudit({ householdId: linked.link.householdId, actorMemberId: linked.link.memberId, action: "transaction.created", entityType: "transaction", entityId: inserted[0].id, summary: `Added EUR ${amount.toFixed(2)} in ${category} via Telegram` });
  return inserted.length > 0;
}

export async function processTelegramUpdate(update: TelegramUpdate) {
  const callback = update.callback_query;
  if (callback) {
    const chatId = callback.message?.chat.id?.toString();
    if (!chatId) { await answerCallback(callback.id, "Please try again"); return; }
    const linked = await activeLink(chatId);
    if (!linked) { await answerCallback(callback.id, "Connect your account first"); return; }
    const callbackRate = await enforceRateLimit(`telegram:${chatId}`, 30);
    if (!callbackRate.allowed) { await answerCallback(callback.id, "Please wait a moment"); return; }
    const db = await getDb();
    if (callback.data === "other:new") {
      await db.insert(telegramConversationState).values({ chatId, state: "awaiting_custom_category", category: null, updatedAt: new Date().toISOString() })
        .onConflictDoUpdate({ target: telegramConversationState.chatId, set: { state: "awaiting_custom_category", category: null, updatedAt: new Date().toISOString() } });
      await answerCallback(callback.id, "Add a new category");
      await replyToTelegram(chatId, "Type the name of the new category, for example: Pets");
      return;
    }
    if (callback.data === "other:keep") {
      await db.insert(telegramConversationState).values({ chatId, state: "awaiting_amount", category: "Other", updatedAt: new Date().toISOString() })
        .onConflictDoUpdate({ target: telegramConversationState.chatId, set: { state: "awaiting_amount", category: "Other", updatedAt: new Date().toISOString() } });
      await answerCallback(callback.id, "Use Other");
      await replyToTelegram(chatId, "Now send only the amount in EUR, for example: 24.50");
      return;
    }
    if (callback.data?.startsWith("custom_category:")) {
      const categoryId = callback.data.slice("custom_category:".length);
      const [custom] = await db.select({ name: expenseCategories.name }).from(expenseCategories)
        .where(and(eq(expenseCategories.id, categoryId), eq(expenseCategories.householdId, linked.link.householdId))).limit(1);
      if (!custom) { await answerCallback(callback.id, "Category not found"); return; }
      await db.insert(telegramConversationState).values({ chatId, state: "awaiting_amount", category: custom.name, updatedAt: new Date().toISOString() })
        .onConflictDoUpdate({ target: telegramConversationState.chatId, set: { state: "awaiting_amount", category: custom.name, updatedAt: new Date().toISOString() } });
      await answerCallback(callback.id, `${custom.name} selected`);
      await replyToTelegram(chatId, `Selected: ${custom.name}\nNow send only the amount in EUR, for example: 24.50`);
      return;
    }
    const category = callback.data?.startsWith("category:") ? callback.data.slice("category:".length) : "";
    if (!knownCategories.includes(category)) { await answerCallback(callback.id, "Please try again"); return; }
    if (category === "Other") {
      await answerCallback(callback.id, "Other selected");
      await replyToTelegram(chatId, "Would you like to add a new category?", {
        inline_keyboard: [[
          { text: "Yes, add new", callback_data: "other:new" },
          { text: "No, use Other", callback_data: "other:keep" },
        ]],
      });
      return;
    }
    await db.insert(telegramConversationState).values({ chatId, state: "awaiting_amount", category, updatedAt: new Date().toISOString() })
      .onConflictDoUpdate({ target: telegramConversationState.chatId, set: { state: "awaiting_amount", category, updatedAt: new Date().toISOString() } });
    await answerCallback(callback.id, `${category} selected`);
    await replyToTelegram(chatId, `Selected: ${category}\nNow send only the amount in EUR, for example: 24.50`);
    return;
  }
  const message = update.message;
  const chatId = message?.chat.id?.toString();
  const text = message?.text?.trim();
  if (!chatId || !text) return;
  if (text.length > 500) {
    await replyToTelegram(chatId, "That message is too long. Please keep the description under 500 characters.");
    return;
  }

  const db = await getDb();
  const messageRate = await enforceRateLimit(`telegram:${chatId}`, 30);
  if (!messageRate.allowed) {
    await replyToTelegram(chatId, `Too many messages. Please wait ${messageRate.retryAfter} seconds.`);
    return;
  }
  if (text.toLowerCase().startsWith("/link ")) {
    const linkCode = text.split(/\s+/)[1]?.toUpperCase();
    const [member] = await db
      .select()
      .from(members)
      .where(and(eq(members.telegramLinkCode, linkCode), eq(members.status, "active")))
      .limit(1);
    if (!member) {
      await replyToTelegram(chatId, "That link code was not found. Copy the latest code from your dashboard and try again.");
      return;
    }
    if (member.telegramLinkCodeExpiresAt && new Date(member.telegramLinkCodeExpiresAt).getTime() < Date.now()) {
      await replyToTelegram(chatId, "That link has expired. Generate a new Telegram link from the dashboard and try again.");
      return;
    }
    await db
      .insert(telegramLinks)
      .values({ chatId, memberId: member.id, householdId: member.householdId, linkedAt: new Date().toISOString() })
      .onConflictDoUpdate({ target: telegramLinks.chatId, set: { memberId: member.id, householdId: member.householdId, linkedAt: new Date().toISOString() } });
    await db.update(members).set({ telegramLinkCode: crypto.randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase(), telegramLinkCodeExpiresAt: new Date().toISOString() }).where(eq(members.id, member.id));
    await writeAudit({ householdId: member.householdId, actorMemberId: member.id, action: "telegram.linked", entityType: "telegram_link", entityId: chatId, summary: "Connected Telegram account" });
    await replyToTelegram(chatId, `Connected as ${member.name} ✓\nTap “Add expense”, choose a category, then send only the amount.`, mainMenu);
    return;
  }

  const linked = await activeLink(chatId);
  if (!linked) {
    await replyToTelegram(chatId, "First connect your account with: /link YOURCODE\nAsk the household owner to copy your personal code from Manage members.");
    return;
  }
  if (text === "/start" || text === "/menu" || text === "/help") {
    await replyToTelegram(chatId, `Hi ${linked.member.name}! Tap the button below to log an expense.`, mainMenu);
    return;
  }
  if (text === "➕ Add expense" || text.toLowerCase() === "/expense") {
    await replyToTelegram(chatId, "Choose a category:", await categoryMenu(linked.link.householdId));
    return;
  }
  if (text === "📊 Budget status" || text.toLowerCase() === "/budget") {
    await replyToTelegram(chatId, await householdBudgetText(linked.link.householdId), mainMenu);
    return;
  }

  const [conversation] = await db.select().from(telegramConversationState).where(eq(telegramConversationState.chatId, chatId)).limit(1);
  if (conversation?.state === "awaiting_custom_category") {
    const category = normalizedCategoryName(text);
    if (category.length < 2 || category.length > 30 || !/^[\p{L}\p{N}][\p{L}\p{N} &'’+\-/]*$/u.test(category)) {
      await replyToTelegram(chatId, "Use a short category name (2–30 letters or numbers), for example: Pets");
      return;
    }
    if (knownCategories.some((item) => categoryNameKey(item) === categoryNameKey(category))) {
      await replyToTelegram(chatId, "That category already exists. Choose it from the menu or enter a different name.", await categoryMenu(linked.link.householdId));
      await db.delete(telegramConversationState).where(eq(telegramConversationState.chatId, chatId));
      return;
    }
    const id = crypto.randomUUID();
    const [existingCategory] = await db.select().from(expenseCategories).where(and(eq(expenseCategories.householdId, linked.link.householdId), eq(expenseCategories.nameKey, categoryNameKey(category)))).limit(1);
    if (existingCategory) {
      await db.update(expenseCategories).set({ name: category, archivedAt: null }).where(eq(expenseCategories.id, existingCategory.id));
    } else {
      await db.insert(expenseCategories).values({
        id, householdId: linked.link.householdId, name: category, nameKey: categoryNameKey(category), createdByMemberId: linked.link.memberId, createdAt: new Date().toISOString(),
      });
      await writeAudit({ householdId: linked.link.householdId, actorMemberId: linked.link.memberId, action: "category.created", entityType: "category", entityId: id, summary: `Created category ${category} via Telegram` });
    }
    const [savedCategory] = await db.select({ name: expenseCategories.name }).from(expenseCategories)
      .where(and(eq(expenseCategories.householdId, linked.link.householdId), eq(expenseCategories.nameKey, categoryNameKey(category)))).limit(1);
    const finalCategory = savedCategory?.name ?? category;
    await db.insert(telegramConversationState).values({ chatId, state: "awaiting_amount", category: finalCategory, updatedAt: new Date().toISOString() })
      .onConflictDoUpdate({ target: telegramConversationState.chatId, set: { state: "awaiting_amount", category: finalCategory, updatedAt: new Date().toISOString() } });
    await replyToTelegram(chatId, `Added: ${finalCategory} ✓\nNow send only the amount in EUR, for example: 24.50`);
    return;
  }
  if (conversation?.state === "awaiting_amount" && conversation.category) {
    const amount = Number(text.replace(",", "."));
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(text) || !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
      await replyToTelegram(chatId, "Please send only a positive number, for example: 24.50");
      return;
    }
    const saved = await saveExpense(update.update_id, chatId, conversation.category, amount);
    await db.delete(telegramConversationState).where(eq(telegramConversationState.chatId, chatId));
    if (saved) await replyToTelegram(chatId, `Saved ✓  €${amount.toFixed(2)} · ${conversation.category}\n\n${await householdBudgetText(linked.link.householdId)}`, mainMenu);
    return;
  }

  const cleaned = text.replace(/^\/expense\s+/i, "").replace(/^expense\s+/i, "");
  const match = cleaned.match(/^(\d+(?:[.,]\d{1,2})?)\s+([^\s]+)(?:\s+(.+))?$/);
  if (!match) {
    await replyToTelegram(chatId, "Tap “Add expense” below, choose a category, then send only the amount.", mainMenu);
    return;
  }
  const amount = Number(match[1].replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
    await replyToTelegram(chatId, "Please enter a valid positive amount.");
    return;
  }
  const requestedCategory = titleCase(match[2]);
  const category = knownCategories.includes(requestedCategory) ? requestedCategory : "Other";
  const note = match[3]?.trim() || requestedCategory;
  const amountCents = Math.round(amount * 100);
  const inserted = await db.insert(transactions).values({
    id: crypto.randomUUID(), householdId: linked.link.householdId, memberId: linked.link.memberId,
    amountCents, baseAmountCents: amountCents, currency: "EUR", category, note,
    type: "expense", source: "telegram", telegramUpdateId: String(update.update_id),
    happenedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
  }).onConflictDoNothing().returning({ id: transactions.id });
  if (inserted.length) await replyToTelegram(chatId, `Saved ✓  €${amount.toFixed(2)} · ${category}\n${note}\n\n${await householdBudgetText(linked.link.householdId)}`, mainMenu);
}

export async function syncTelegramUpdates() {
  const botToken = await token();
  if (!botToken) return { ok: false, processed: 0, reason: "not_configured" };
  const db = await getDb();
  const [state] = await db.select().from(telegramBotState).where(eq(telegramBotState.id, "main")).limit(1);
  const offset = state?.nextUpdateId ?? 0;
  const response = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates?offset=${offset}&limit=100&timeout=0&allowed_updates=${encodeURIComponent(JSON.stringify(["message", "callback_query"]))}`, { cache: "no-store" });
  const result = await response.json() as { ok?: boolean; description?: string; result?: TelegramUpdate[] };
  if (!response.ok || !result.ok) return { ok: false, processed: 0, reason: result.description || "telegram_error" };

  let nextUpdateId = offset;
  let processed = 0;
  for (const update of (result.result ?? []).sort((a, b) => a.update_id - b.update_id)) {
    await processTelegramUpdate(update);
    nextUpdateId = update.update_id + 1;
    processed += 1;
    await db.insert(telegramBotState).values({ id: "main", nextUpdateId, updatedAt: new Date().toISOString() })
      .onConflictDoUpdate({ target: telegramBotState.id, set: { nextUpdateId, updatedAt: new Date().toISOString() } });
  }
  return { ok: true, processed };
}
