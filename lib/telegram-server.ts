import { env } from "cloudflare:workers";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../db";
import {
  expenseCategories,
  members,
  telegramBotState,
  telegramConversationState,
  telegramLinks,
  transactions,
} from "../db/schema";
import { enforceRateLimit, writeAudit } from "./security";
import {
  budgetMonthlySummaryText,
  budgetTelegramText,
  calculateBudgetStatus,
  type TelegramLanguage,
} from "./budget";

export type TelegramUpdate = {
  update_id: number;
  message?: {
    chat: { id: number };
    text?: string;
    from?: { language_code?: string };
  };
  callback_query?: {
    id: string;
    data?: string;
    message?: { chat: { id: number } };
    from?: { language_code?: string };
  };
};

const knownCategories = [
  "Groceries",
  "Dining",
  "Transport",
  "Home",
  "Health",
  "Leisure",
  "Bills",
  "Other",
];

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function token() {
  const value = (env as unknown as Record<string, unknown>).TELEGRAM_BOT_TOKEN;
  return typeof value === "string" ? value.trim() : "";
}

const botCopy = {
  en: {
    buttons: {
      add: "➕ Add expense",
      budget: "📊 Budget status",
      month: "📅 Monthly summary",
      language: "🌐 Language",
    },
    categories: {
      Groceries: "🛒 Groceries",
      Dining: "☕ Dining",
      Transport: "🚆 Transport",
      Home: "🏠 Home",
      Health: "❤️ Health",
      Leisure: "✨ Leisure",
      Bills: "🧾 Bills",
      Other: "••• Other",
    },
    chooseCategory: "Choose a category:",
    chooseLanguage: "Choose your language:",
    languageSaved: "Language changed to English ✓",
    tryAgain: "Please try again",
    connectFirst: "Connect your account first",
    wait: "Please wait a moment",
    addCategory: "Add a new category",
    typeCategory: "Type the name of the new category, for example: Pets",
    useOther: "Use Other",
    amountOnly: "Now send only the amount in EUR, for example: 24.50",
    categoryNotFound: "Category not found",
    selected: (name: string) =>
      `Selected: ${name}\nNow send only the amount in EUR, for example: 24.50`,
    selectedShort: (name: string) => `${name} selected`,
    otherQuestion: "Would you like to add a new category?",
    yesAdd: "Yes, add new",
    noOther: "No, use Other",
    tooLong:
      "That message is too long. Please keep the description under 500 characters.",
    tooMany: (seconds: number) =>
      `Too many messages. Please wait ${seconds} seconds.`,
    linkNotFound:
      "That link code was not found. Copy the latest code from your dashboard and try again.",
    linkExpired:
      "That link has expired. Generate a new Telegram link from the dashboard and try again.",
    connected: (name: string) =>
      `Connected as ${name} ✓\nTap “Add expense”, choose a category, then send only the amount.`,
    firstConnect:
      "First connect your account with: /link YOURCODE\nGenerate your personal code from your own dashboard.",
    hello: (name: string) =>
      `Hi ${name}! Choose an option from the menu below.`,
    invalidCategory:
      "Use a short category name (2–30 letters or numbers), for example: Pets",
    categoryExists:
      "That category already exists. Choose it from the menu or enter a different name.",
    categoryAdded: (name: string) =>
      `Added: ${name} ✓\nNow send only the amount in EUR, for example: 24.50`,
    invalidAmount: "Please send only a positive number, for example: 24.50",
    tapAdd:
      "Tap “Add expense” below, choose a category, then send only the amount.",
    invalidPositive: "Please enter a valid positive amount.",
    saved: (amount: number, category: string, note?: string) =>
      `Saved ✓  €${amount.toFixed(2)} · ${category}${note ? `\n${note}` : ""}`,
  },
  nl: {
    buttons: {
      add: "➕ Uitgave toevoegen",
      budget: "📊 Budgetstatus",
      month: "📅 Maandoverzicht",
      language: "🌐 Taal",
    },
    categories: {
      Groceries: "🛒 Boodschappen",
      Dining: "☕ Uit eten",
      Transport: "🚆 Vervoer",
      Home: "🏠 Wonen",
      Health: "❤️ Gezondheid",
      Leisure: "✨ Vrije tijd",
      Bills: "🧾 Rekeningen",
      Other: "••• Overig",
    },
    chooseCategory: "Kies een categorie:",
    chooseLanguage: "Kies je taal:",
    languageSaved: "Taal gewijzigd naar Nederlands ✓",
    tryAgain: "Probeer het opnieuw",
    connectFirst: "Koppel eerst je account",
    wait: "Wacht even",
    addCategory: "Nieuwe categorie toevoegen",
    typeCategory: "Typ de naam van de nieuwe categorie, bijvoorbeeld: Huisdieren",
    useOther: "Overig gebruiken",
    amountOnly: "Stuur nu alleen het bedrag in EUR, bijvoorbeeld: 24.50",
    categoryNotFound: "Categorie niet gevonden",
    selected: (name: string) =>
      `Geselecteerd: ${name}\nStuur nu alleen het bedrag in EUR, bijvoorbeeld: 24.50`,
    selectedShort: (name: string) => `${name} geselecteerd`,
    otherQuestion: "Wil je een nieuwe categorie toevoegen?",
    yesAdd: "Ja, toevoegen",
    noOther: "Nee, Overig gebruiken",
    tooLong: "Dit bericht is te lang. Houd de beschrijving onder 500 tekens.",
    tooMany: (seconds: number) =>
      `Te veel berichten. Wacht ${seconds} seconden.`,
    linkNotFound:
      "Deze koppelcode is niet gevonden. Kopieer de nieuwste code uit je dashboard en probeer het opnieuw.",
    linkExpired:
      "Deze koppelcode is verlopen. Genereer een nieuwe Telegram-code in je dashboard.",
    connected: (name: string) =>
      `Gekoppeld als ${name} ✓\nTik op “Uitgave toevoegen”, kies een categorie en stuur alleen het bedrag.`,
    firstConnect:
      "Koppel eerst je account met: /link JOUWCODE\nGenereer je persoonlijke code in je eigen dashboard.",
    hello: (name: string) =>
      `Hoi ${name}! Kies hieronder een optie.`,
    invalidCategory:
      "Gebruik een korte categorienaam (2–30 letters of cijfers), bijvoorbeeld: Huisdieren",
    categoryExists:
      "Deze categorie bestaat al. Kies haar in het menu of voer een andere naam in.",
    categoryAdded: (name: string) =>
      `Toegevoegd: ${name} ✓\nStuur nu alleen het bedrag in EUR, bijvoorbeeld: 24.50`,
    invalidAmount: "Stuur alleen een positief bedrag, bijvoorbeeld: 24.50",
    tapAdd:
      "Tik hieronder op “Uitgave toevoegen”, kies een categorie en stuur alleen het bedrag.",
    invalidPositive: "Voer een geldig positief bedrag in.",
    saved: (amount: number, category: string, note?: string) =>
      `Opgeslagen ✓  €${amount.toFixed(2)} · ${category}${note ? `\n${note}` : ""}`,
  },
  fa: {
    buttons: {
      add: "➕ ثبت هزینه",
      budget: "📊 وضعیت بودجه",
      month: "📅 خلاصهٔ ماهانه",
      language: "🌐 زبان",
    },
    categories: {
      Groceries: "🛒 خرید روزمره",
      Dining: "☕ رستوران و کافه",
      Transport: "🚆 حمل‌ونقل",
      Home: "🏠 خانه",
      Health: "❤️ سلامت",
      Leisure: "✨ تفریح",
      Bills: "🧾 قبوض",
      Other: "••• سایر",
    },
    chooseCategory: "یک دسته‌بندی انتخاب کنید:",
    chooseLanguage: "زبان خود را انتخاب کنید:",
    languageSaved: "زبان به فارسی تغییر کرد ✓",
    tryAgain: "لطفاً دوباره تلاش کنید",
    connectFirst: "ابتدا حساب خود را متصل کنید",
    wait: "لطفاً کمی صبر کنید",
    addCategory: "افزودن دسته‌بندی جدید",
    typeCategory: "نام دسته‌بندی جدید را بنویسید؛ برای مثال: حیوانات خانگی",
    useOther: "استفاده از سایر",
    amountOnly: "حالا فقط مبلغ را به یورو بفرستید؛ برای مثال: 24.50",
    categoryNotFound: "دسته‌بندی پیدا نشد",
    selected: (name: string) =>
      `انتخاب شد: ${name}\nحالا فقط مبلغ را به یورو بفرستید؛ برای مثال: 24.50`,
    selectedShort: (name: string) => `${name} انتخاب شد`,
    otherQuestion: "می‌خواهید یک دسته‌بندی جدید اضافه کنید؟",
    yesAdd: "بله، اضافه کن",
    noOther: "نه، از سایر استفاده کن",
    tooLong: "این پیام خیلی طولانی است. توضیحات باید کمتر از ۵۰۰ نویسه باشد.",
    tooMany: (seconds: number) =>
      `تعداد پیام‌ها زیاد است. ${seconds} ثانیه صبر کنید.`,
    linkNotFound:
      "این کد اتصال پیدا نشد. جدیدترین کد را از داشبورد خود کپی و دوباره امتحان کنید.",
    linkExpired:
      "مهلت این کد تمام شده است. از داشبورد خود یک کد جدید Telegram بسازید.",
    connected: (name: string) =>
      `حساب ${name} متصل شد ✓\nروی «ثبت هزینه» بزنید، دسته‌بندی را انتخاب کنید و فقط مبلغ را بفرستید.`,
    firstConnect:
      "ابتدا حساب را با این دستور متصل کنید: /link YOURCODE\nکد شخصی را از داشبورد خودتان بسازید.",
    hello: (name: string) =>
      `سلام ${name}! یکی از گزینه‌های زیر را انتخاب کنید.`,
    invalidCategory:
      "یک نام کوتاه ۲ تا ۳۰ حرفی یا عددی وارد کنید؛ برای مثال: حیوانات خانگی",
    categoryExists:
      "این دسته‌بندی از قبل وجود دارد. آن را از منو انتخاب کنید یا نام دیگری بنویسید.",
    categoryAdded: (name: string) =>
      `اضافه شد: ${name} ✓\nحالا فقط مبلغ را به یورو بفرستید؛ برای مثال: 24.50`,
    invalidAmount: "فقط یک مبلغ مثبت بفرستید؛ برای مثال: 24.50",
    tapAdd:
      "روی «ثبت هزینه» بزنید، دسته‌بندی را انتخاب کنید و فقط مبلغ را بفرستید.",
    invalidPositive: "یک مبلغ مثبت و معتبر وارد کنید.",
    saved: (amount: number, category: string, note?: string) =>
      `ذخیره شد ✓  €${amount.toFixed(2)} · ${category}${note ? `\n${note}` : ""}`,
  },
} satisfies Record<TelegramLanguage, object>;

function normalizeLanguage(value: unknown): TelegramLanguage {
  return value === "nl" || value === "fa" ? value : "en";
}

function telegramLanguage(value?: string): TelegramLanguage {
  const code = value?.toLowerCase() ?? "";
  if (code.startsWith("nl")) return "nl";
  if (code.startsWith("fa")) return "fa";
  return "en";
}

function mainMenu(language: TelegramLanguage) {
  const buttons = botCopy[language].buttons;
  return {
    keyboard: [
      [{ text: buttons.add }, { text: buttons.budget }],
      [{ text: buttons.month }, { text: buttons.language }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

function languageMenu() {
  return {
    inline_keyboard: [
      [
        { text: "English", callback_data: "language:en" },
        { text: "Nederlands", callback_data: "language:nl" },
        { text: "فارسی", callback_data: "language:fa" },
      ],
    ],
  };
}

function matchesButton(
  text: string,
  button: "add" | "budget" | "month" | "language",
) {
  return (Object.keys(botCopy) as TelegramLanguage[]).some(
    (language) => botCopy[language].buttons[button] === text,
  );
}

function categoryDisplay(language: TelegramLanguage, category: string) {
  return knownCategories.includes(category)
    ? botCopy[language].categories[
        category as keyof (typeof botCopy)["en"]["categories"]
      ]
    : category;
}

function normalizedCategoryName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function categoryNameKey(value: string) {
  return normalizedCategoryName(value).toLocaleLowerCase("en-US");
}

async function categoryMenu(
  householdId: string,
  language: TelegramLanguage,
) {
  const db = await getDb();
  const custom = await db
    .select({ id: expenseCategories.id, name: expenseCategories.name })
    .from(expenseCategories)
    .where(
      and(
        eq(expenseCategories.householdId, householdId),
        isNull(expenseCategories.archivedAt),
      ),
    );
  const buttons = [
    ...knownCategories
      .filter((category) => category !== "Other")
      .map((category) => ({
        text: botCopy[language].categories[
          category as keyof (typeof botCopy)["en"]["categories"]
        ],
        callback_data: `category:${category}`,
      })),
    ...custom
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((item) => ({
        text: `• ${item.name}`,
        callback_data: `custom_category:${item.id}`,
      })),
    {
      text: botCopy[language].categories.Other,
      callback_data: "category:Other",
    },
  ];
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  for (let index = 0; index < buttons.length; index += 2)
    rows.push(buttons.slice(index, index + 2));
  return { inline_keyboard: rows };
}

export async function replyToTelegram(
  chatId: string,
  text: string,
  replyMarkup?: Record<string, unknown>,
) {
  const botToken = await token();
  if (!botToken) return;
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  });
}

async function answerCallback(callbackId: string, text?: string) {
  const botToken = await token();
  if (!botToken) return;
  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackId,
      ...(text ? { text } : {}),
    }),
  });
}

async function activeLink(chatId: string) {
  const db = await getDb();
  const [link] = await db
    .select()
    .from(telegramLinks)
    .where(eq(telegramLinks.chatId, chatId))
    .limit(1);
  if (!link) return null;
  const [member] = await db
    .select({ id: members.id, name: members.name })
    .from(members)
    .where(and(eq(members.id, link.memberId), eq(members.status, "active")))
    .limit(1);
  if (!member) {
    await db.delete(telegramLinks).where(eq(telegramLinks.chatId, chatId));
    return null;
  }
  return { link, member };
}

async function memberBudgetStatus(householdId: string, memberId: string) {
  const db = await getDb();
  const items = await db
    .select({
      type: transactions.type,
      baseAmountCents: transactions.baseAmountCents,
      happenedAt: transactions.happenedAt,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.householdId, householdId),
        eq(transactions.memberId, memberId),
        isNull(transactions.deletedAt),
      ),
    );
  return calculateBudgetStatus(
    items as Array<{
      type: "expense" | "income";
      baseAmountCents: number;
      happenedAt: string;
    }>,
  );
}

async function memberBudgetText(
  householdId: string,
  memberId: string,
  language: TelegramLanguage,
) {
  return budgetTelegramText(
    await memberBudgetStatus(householdId, memberId),
    language,
  );
}

async function memberMonthlySummaryText(
  householdId: string,
  memberId: string,
  language: TelegramLanguage,
) {
  return budgetMonthlySummaryText(
    await memberBudgetStatus(householdId, memberId),
    language,
  );
}

async function saveExpense(
  updateId: number,
  chatId: string,
  category: string,
  amount: number,
) {
  const linked = await activeLink(chatId);
  if (!linked) return false;
  const db = await getDb();
  const amountCents = Math.round(amount * 100);
  const inserted = await db
    .insert(transactions)
    .values({
      id: crypto.randomUUID(),
      householdId: linked.link.householdId,
      memberId: linked.link.memberId,
      amountCents,
      baseAmountCents: amountCents,
      currency: "EUR",
      category,
      note: category,
      type: "expense",
      source: "telegram",
      telegramUpdateId: String(updateId),
      happenedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    })
    .onConflictDoNothing()
    .returning({ id: transactions.id });
  if (inserted.length)
    await writeAudit({
      householdId: linked.link.householdId,
      actorMemberId: linked.link.memberId,
      action: "transaction.created",
      entityType: "transaction",
      entityId: inserted[0].id,
      summary: `Added EUR ${amount.toFixed(2)} in ${category} via Telegram`,
    });
  return inserted.length > 0;
}

export async function processTelegramUpdate(update: TelegramUpdate) {
  const callback = update.callback_query;
  if (callback) {
    const fallbackLanguage = telegramLanguage(callback.from?.language_code);
    const chatId = callback.message?.chat.id?.toString();
    if (!chatId) {
      await answerCallback(callback.id, botCopy[fallbackLanguage].tryAgain);
      return;
    }
    const linked = await activeLink(chatId);
    if (!linked) {
      await answerCallback(
        callback.id,
        botCopy[fallbackLanguage].connectFirst,
      );
      return;
    }
    const language = normalizeLanguage(linked.link.language);
    const copy = botCopy[language];
    const callbackRate = await enforceRateLimit(`telegram:${chatId}`, 30);
    if (!callbackRate.allowed) {
      await answerCallback(callback.id, copy.wait);
      return;
    }
    const db = await getDb();
    if (callback.data?.startsWith("language:")) {
      const requested = callback.data.slice("language:".length);
      const newLanguage = normalizeLanguage(requested);
      await db
        .update(telegramLinks)
        .set({ language: newLanguage })
        .where(eq(telegramLinks.chatId, chatId));
      await answerCallback(
        callback.id,
        botCopy[newLanguage].languageSaved,
      );
      await replyToTelegram(
        chatId,
        botCopy[newLanguage].languageSaved,
        mainMenu(newLanguage),
      );
      return;
    }
    if (callback.data === "other:new") {
      await db
        .insert(telegramConversationState)
        .values({
          chatId,
          state: "awaiting_custom_category",
          category: null,
          updatedAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
          target: telegramConversationState.chatId,
          set: {
            state: "awaiting_custom_category",
            category: null,
            updatedAt: new Date().toISOString(),
          },
        });
      await answerCallback(callback.id, copy.addCategory);
      await replyToTelegram(chatId, copy.typeCategory);
      return;
    }
    if (callback.data === "other:keep") {
      await db
        .insert(telegramConversationState)
        .values({
          chatId,
          state: "awaiting_amount",
          category: "Other",
          updatedAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
          target: telegramConversationState.chatId,
          set: {
            state: "awaiting_amount",
            category: "Other",
            updatedAt: new Date().toISOString(),
          },
        });
      await answerCallback(callback.id, copy.useOther);
      await replyToTelegram(chatId, copy.amountOnly);
      return;
    }
    if (callback.data?.startsWith("custom_category:")) {
      const categoryId = callback.data.slice("custom_category:".length);
      const [custom] = await db
        .select({ name: expenseCategories.name })
        .from(expenseCategories)
        .where(
          and(
            eq(expenseCategories.id, categoryId),
            eq(expenseCategories.householdId, linked.link.householdId),
          ),
        )
        .limit(1);
      if (!custom) {
        await answerCallback(callback.id, copy.categoryNotFound);
        return;
      }
      await db
        .insert(telegramConversationState)
        .values({
          chatId,
          state: "awaiting_amount",
          category: custom.name,
          updatedAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
          target: telegramConversationState.chatId,
          set: {
            state: "awaiting_amount",
            category: custom.name,
            updatedAt: new Date().toISOString(),
          },
        });
      await answerCallback(callback.id, copy.selectedShort(custom.name));
      await replyToTelegram(chatId, copy.selected(custom.name));
      return;
    }
    const category = callback.data?.startsWith("category:")
      ? callback.data.slice("category:".length)
      : "";
    if (!knownCategories.includes(category)) {
      await answerCallback(callback.id, copy.tryAgain);
      return;
    }
    if (category === "Other") {
      await answerCallback(
        callback.id,
        copy.selectedShort(categoryDisplay(language, "Other")),
      );
      await replyToTelegram(chatId, copy.otherQuestion, {
        inline_keyboard: [
          [
            { text: copy.yesAdd, callback_data: "other:new" },
            { text: copy.noOther, callback_data: "other:keep" },
          ],
        ],
      });
      return;
    }
    await db
      .insert(telegramConversationState)
      .values({
        chatId,
        state: "awaiting_amount",
        category,
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: telegramConversationState.chatId,
        set: {
          state: "awaiting_amount",
          category,
          updatedAt: new Date().toISOString(),
        },
      });
    const displayedCategory = categoryDisplay(language, category);
    await answerCallback(callback.id, copy.selectedShort(displayedCategory));
    await replyToTelegram(chatId, copy.selected(displayedCategory));
    return;
  }
  const message = update.message;
  const chatId = message?.chat.id?.toString();
  const text = message?.text?.trim();
  if (!chatId || !text) return;
  const fallbackLanguage = telegramLanguage(message?.from?.language_code);
  if (text.length > 500) {
    await replyToTelegram(chatId, botCopy[fallbackLanguage].tooLong);
    return;
  }

  const db = await getDb();
  const messageRate = await enforceRateLimit(`telegram:${chatId}`, 30);
  if (!messageRate.allowed) {
    await replyToTelegram(
      chatId,
      botCopy[fallbackLanguage].tooMany(messageRate.retryAfter),
    );
    return;
  }
  if (text.toLowerCase().startsWith("/link ")) {
    const linkCode = text.split(/\s+/)[1]?.toUpperCase();
    const [member] = await db
      .select()
      .from(members)
      .where(
        and(
          eq(members.telegramLinkCode, linkCode),
          eq(members.status, "active"),
        ),
      )
      .limit(1);
    if (!member) {
      await replyToTelegram(chatId, botCopy[fallbackLanguage].linkNotFound);
      return;
    }
    if (
      member.telegramLinkCodeExpiresAt &&
      new Date(member.telegramLinkCodeExpiresAt).getTime() < Date.now()
    ) {
      await replyToTelegram(chatId, botCopy[fallbackLanguage].linkExpired);
      return;
    }
    await db
      .insert(telegramLinks)
      .values({
        chatId,
        memberId: member.id,
        householdId: member.householdId,
        language: fallbackLanguage,
        linkedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: telegramLinks.chatId,
        set: {
          memberId: member.id,
          householdId: member.householdId,
          language: fallbackLanguage,
          linkedAt: new Date().toISOString(),
        },
      });
    await db
      .update(members)
      .set({
        telegramLinkCode: crypto
          .randomUUID()
          .replaceAll("-", "")
          .slice(0, 16)
          .toUpperCase(),
        telegramLinkCodeExpiresAt: new Date().toISOString(),
      })
      .where(eq(members.id, member.id));
    await writeAudit({
      householdId: member.householdId,
      actorMemberId: member.id,
      action: "telegram.linked",
      entityType: "telegram_link",
      entityId: chatId,
      summary: "Connected Telegram account",
    });
    await replyToTelegram(
      chatId,
      botCopy[fallbackLanguage].connected(member.name),
      mainMenu(fallbackLanguage),
    );
    return;
  }

  const linked = await activeLink(chatId);
  if (!linked) {
    await replyToTelegram(chatId, botCopy[fallbackLanguage].firstConnect);
    return;
  }
  const language = normalizeLanguage(linked.link.language);
  const copy = botCopy[language];
  if (text === "/start" || text === "/menu" || text === "/help") {
    await replyToTelegram(
      chatId,
      copy.hello(linked.member.name),
      mainMenu(language),
    );
    return;
  }
  if (matchesButton(text, "add") || text.toLowerCase() === "/expense") {
    await replyToTelegram(
      chatId,
      copy.chooseCategory,
      await categoryMenu(linked.link.householdId, language),
    );
    return;
  }
  if (matchesButton(text, "budget") || text.toLowerCase() === "/budget") {
    await replyToTelegram(
      chatId,
      await memberBudgetText(
        linked.link.householdId,
        linked.link.memberId,
        language,
      ),
      mainMenu(language),
    );
    return;
  }
  if (
    matchesButton(text, "month") ||
    text.toLowerCase() === "/month" ||
    text.toLowerCase() === "/summary"
  ) {
    await replyToTelegram(
      chatId,
      await memberMonthlySummaryText(
        linked.link.householdId,
        linked.link.memberId,
        language,
      ),
      mainMenu(language),
    );
    return;
  }
  if (matchesButton(text, "language") || text.toLowerCase() === "/language") {
    await replyToTelegram(chatId, copy.chooseLanguage, languageMenu());
    return;
  }

  const [conversation] = await db
    .select()
    .from(telegramConversationState)
    .where(eq(telegramConversationState.chatId, chatId))
    .limit(1);
  if (conversation?.state === "awaiting_custom_category") {
    const category = normalizedCategoryName(text);
    if (
      category.length < 2 ||
      category.length > 30 ||
      !/^[\p{L}\p{N}][\p{L}\p{N} &'’+\-/]*$/u.test(category)
    ) {
      await replyToTelegram(
        chatId,
        copy.invalidCategory,
      );
      return;
    }
    if (
      knownCategories.some(
        (item) => categoryNameKey(item) === categoryNameKey(category),
      )
    ) {
      await replyToTelegram(
        chatId,
        copy.categoryExists,
        await categoryMenu(linked.link.householdId, language),
      );
      await db
        .delete(telegramConversationState)
        .where(eq(telegramConversationState.chatId, chatId));
      return;
    }
    const id = crypto.randomUUID();
    const [existingCategory] = await db
      .select()
      .from(expenseCategories)
      .where(
        and(
          eq(expenseCategories.householdId, linked.link.householdId),
          eq(expenseCategories.nameKey, categoryNameKey(category)),
        ),
      )
      .limit(1);
    if (existingCategory) {
      await db
        .update(expenseCategories)
        .set({ name: category, archivedAt: null })
        .where(eq(expenseCategories.id, existingCategory.id));
    } else {
      await db.insert(expenseCategories).values({
        id,
        householdId: linked.link.householdId,
        name: category,
        nameKey: categoryNameKey(category),
        createdByMemberId: linked.link.memberId,
        createdAt: new Date().toISOString(),
      });
      await writeAudit({
        householdId: linked.link.householdId,
        actorMemberId: linked.link.memberId,
        action: "category.created",
        entityType: "category",
        entityId: id,
        summary: `Created category ${category} via Telegram`,
      });
    }
    const [savedCategory] = await db
      .select({ name: expenseCategories.name })
      .from(expenseCategories)
      .where(
        and(
          eq(expenseCategories.householdId, linked.link.householdId),
          eq(expenseCategories.nameKey, categoryNameKey(category)),
        ),
      )
      .limit(1);
    const finalCategory = savedCategory?.name ?? category;
    await db
      .insert(telegramConversationState)
      .values({
        chatId,
        state: "awaiting_amount",
        category: finalCategory,
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: telegramConversationState.chatId,
        set: {
          state: "awaiting_amount",
          category: finalCategory,
          updatedAt: new Date().toISOString(),
        },
      });
    await replyToTelegram(
      chatId,
      copy.categoryAdded(finalCategory),
    );
    return;
  }
  if (conversation?.state === "awaiting_amount" && conversation.category) {
    const amount = Number(text.replace(",", "."));
    if (
      !/^\d+(?:[.,]\d{1,2})?$/.test(text) ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > 1_000_000_000
    ) {
      await replyToTelegram(
        chatId,
        copy.invalidAmount,
      );
      return;
    }
    const saved = await saveExpense(
      update.update_id,
      chatId,
      conversation.category,
      amount,
    );
    await db
      .delete(telegramConversationState)
      .where(eq(telegramConversationState.chatId, chatId));
    if (saved)
      await replyToTelegram(
        chatId,
        `${copy.saved(amount, categoryDisplay(language, conversation.category))}\n\n${await memberBudgetText(linked.link.householdId, linked.link.memberId, language)}`,
        mainMenu(language),
      );
    return;
  }

  const cleaned = text
    .replace(/^\/expense\s+/i, "")
    .replace(/^expense\s+/i, "");
  const match = cleaned.match(/^(\d+(?:[.,]\d{1,2})?)\s+([^\s]+)(?:\s+(.+))?$/);
  if (!match) {
    await replyToTelegram(
      chatId,
      copy.tapAdd,
      mainMenu(language),
    );
    return;
  }
  const amount = Number(match[1].replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
    await replyToTelegram(chatId, copy.invalidPositive);
    return;
  }
  const requestedCategory = titleCase(match[2]);
  const category = knownCategories.includes(requestedCategory)
    ? requestedCategory
    : "Other";
  const note = match[3]?.trim() || requestedCategory;
  const amountCents = Math.round(amount * 100);
  const inserted = await db
    .insert(transactions)
    .values({
      id: crypto.randomUUID(),
      householdId: linked.link.householdId,
      memberId: linked.link.memberId,
      amountCents,
      baseAmountCents: amountCents,
      currency: "EUR",
      category,
      note,
      type: "expense",
      source: "telegram",
      telegramUpdateId: String(update.update_id),
      happenedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    })
    .onConflictDoNothing()
    .returning({ id: transactions.id });
  if (inserted.length)
    await replyToTelegram(
      chatId,
      `${copy.saved(amount, categoryDisplay(language, category), note)}\n\n${await memberBudgetText(linked.link.householdId, linked.link.memberId, language)}`,
      mainMenu(language),
    );
}

export async function syncTelegramUpdates() {
  const botToken = await token();
  if (!botToken) return { ok: false, processed: 0, reason: "not_configured" };
  const db = await getDb();
  const [state] = await db
    .select()
    .from(telegramBotState)
    .where(eq(telegramBotState.id, "main"))
    .limit(1);
  const offset = state?.nextUpdateId ?? 0;
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/getUpdates?offset=${offset}&limit=100&timeout=0&allowed_updates=${encodeURIComponent(JSON.stringify(["message", "callback_query"]))}`,
    { cache: "no-store" },
  );
  const result = (await response.json()) as {
    ok?: boolean;
    description?: string;
    result?: TelegramUpdate[];
  };
  if (!response.ok || !result.ok)
    return {
      ok: false,
      processed: 0,
      reason: result.description || "telegram_error",
    };

  let nextUpdateId = offset;
  let processed = 0;
  for (const update of (result.result ?? []).sort(
    (a, b) => a.update_id - b.update_id,
  )) {
    await processTelegramUpdate(update);
    nextUpdateId = update.update_id + 1;
    processed += 1;
    await db
      .insert(telegramBotState)
      .values({ id: "main", nextUpdateId, updatedAt: new Date().toISOString() })
      .onConflictDoUpdate({
        target: telegramBotState.id,
        set: { nextUpdateId, updatedAt: new Date().toISOString() },
      });
  }
  return { ok: true, processed };
}
