import type { Transaction } from "./types";

export const DAILY_FAMILY_BUDGET_CENTS = 2_000;
export const BUDGET_START_DATE = "2026-08-11";
const TIME_ZONE = "Europe/Amsterdam";

export type TelegramLanguage = "en" | "nl" | "fa";
export type BudgetCurrency = "EUR" | "USD" | "CAD" | "GBP";
export type DailyBudgetRule = {
  effectiveDate: string;
  dailyBudgetCents: number;
};

export function budgetDateKey(value: Date | string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(typeof value === "string" ? new Date(value) : value);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function budgetMonthKey(value: Date | string = new Date()) {
  return budgetDateKey(value).slice(0, 7);
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthlyBudgetPlanCents(
  monthKey: string,
  adjustmentCents = 0,
  dailyBudgetRules?: DailyBudgetRule[],
) {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) return adjustmentCents;
  const rules = normalizedRules(dailyBudgetRules);
  let plan = 0;
  for (let day = 1; day <= daysInMonth(year, month); day += 1) {
    const key = `${monthKey}-${String(day).padStart(2, "0")}`;
    plan += budgetForDate(key, rules);
  }
  return plan + adjustmentCents;
}

function normalizedRules(dailyBudgetRules?: DailyBudgetRule[]) {
  const source = dailyBudgetRules ?? [
    {
      effectiveDate: BUDGET_START_DATE,
      dailyBudgetCents: DAILY_FAMILY_BUDGET_CENTS,
    },
  ];
  return [...source]
    .filter(
      (item) =>
        /^\d{4}-\d{2}-\d{2}$/.test(item.effectiveDate) &&
        Number.isFinite(item.dailyBudgetCents) &&
        item.dailyBudgetCents > 0,
    )
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
}

function budgetForDate(date: string, rules: DailyBudgetRule[]) {
  let amount = 0;
  for (const rule of rules) {
    if (rule.effectiveDate > date) break;
    amount = rule.dailyBudgetCents;
  }
  return amount;
}

export type BudgetStatus = {
  todayKey: string;
  todaySpentCents: number;
  dailyBudgetCents: number;
  dailyDifferenceCents: number;
  dailyState: "neutral" | "under" | "over";
  monthSpentCents: number;
  monthToDateBudgetCents: number;
  fullMonthBudgetCents: number;
  monthDifferenceCents: number;
  monthState: "neutral" | "under" | "over";
  previousDaysSpentCents: number;
  previousDaysBudgetCents: number;
  previousDaysCarryoverCents: number;
  remainingDaysAfterToday: number;
  remainingDaysIncludingToday: number;
  remainingBudgetAfterTodayCents: number;
  plannedBudgetIncludingTodayCents: number;
  totalAvailableThroughMonthEndCents: number;
  recommendedDailyAverageCents: number;
  adjustmentCents: number;
  currency: BudgetCurrency;
};

export function calculateBudgetStatus(
  transactions: Pick<
    Transaction,
    "type" | "baseAmountCents" | "happenedAt"
  >[],
  now = new Date(),
  adjustmentCents = 0,
  dailyBudgetRules?: DailyBudgetRule[],
  currency: BudgetCurrency = "EUR",
): BudgetStatus {
  const todayKey = budgetDateKey(now);
  const [year, month, day] = todayKey.split("-").map(Number);
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}-`;
  const rules = normalizedRules(dailyBudgetRules);
  const activeToday = budgetForDate(todayKey, rules) > 0;
  const monthLength = daysInMonth(year, month);

  const eligible = transactions.filter((item) => {
    const itemDate = budgetDateKey(item.happenedAt);
    return (
      item.type === "expense" &&
      itemDate.startsWith(monthPrefix) &&
      budgetForDate(itemDate, rules) > 0
    );
  });

  const todaySpentCents = eligible
    .filter((item) => budgetDateKey(item.happenedAt) === todayKey)
    .reduce((sum, item) => sum + item.baseAmountCents, 0);
  const previousDaysSpentCents = eligible
    .filter((item) => budgetDateKey(item.happenedAt) < todayKey)
    .reduce((sum, item) => sum + item.baseAmountCents, 0);
  const monthSpentCents = eligible.reduce(
    (sum, item) => sum + item.baseAmountCents,
    0,
  );
  let previousDaysBudgetCents = 0;
  let monthToDateBudgetCents = 0;
  let fullMonthBudgetCents = 0;
  let remainingBudgetAfterTodayCents = 0;
  let remainingDaysAfterToday = 0;
  for (let currentDay = 1; currentDay <= monthLength; currentDay += 1) {
    const key = `${monthPrefix}${String(currentDay).padStart(2, "0")}`;
    const amount = budgetForDate(key, rules);
    fullMonthBudgetCents += amount;
    if (currentDay < day) previousDaysBudgetCents += amount;
    if (currentDay <= day) monthToDateBudgetCents += amount;
    if (currentDay > day && amount > 0) {
      remainingBudgetAfterTodayCents += amount;
      remainingDaysAfterToday += 1;
    }
  }
  const previousDaysCarryoverCents =
    previousDaysBudgetCents - previousDaysSpentCents;
  const remainingDaysIncludingToday = activeToday
    ? remainingDaysAfterToday + 1
    : remainingDaysAfterToday;
  const dailyBudgetCents = budgetForDate(todayKey, rules);
  const dailyDifferenceCents =
    dailyBudgetCents - todaySpentCents;
  const plannedBudgetIncludingTodayCents =
    remainingBudgetAfterTodayCents + dailyBudgetCents;
  const totalAvailableThroughMonthEndCents = activeToday
    ? previousDaysCarryoverCents +
      remainingBudgetAfterTodayCents +
      dailyDifferenceCents +
      adjustmentCents
    : remainingBudgetAfterTodayCents + adjustmentCents;
  const recommendedDailyAverageCents = remainingDaysAfterToday
    ? Math.max(
        0,
        Math.floor(
          totalAvailableThroughMonthEndCents / remainingDaysAfterToday,
        ),
      )
    : 0;
  const monthDifferenceCents = monthToDateBudgetCents - monthSpentCents;
  const dailyState =
    todaySpentCents === 0
      ? "neutral"
      : dailyDifferenceCents >= 0
        ? "under"
        : "over";
  const monthState =
    monthSpentCents === 0
      ? "neutral"
      : monthDifferenceCents >= 0
        ? "under"
        : "over";

  return {
    todayKey,
    todaySpentCents,
    dailyBudgetCents,
    dailyDifferenceCents,
    dailyState,
    monthSpentCents,
    monthToDateBudgetCents,
    fullMonthBudgetCents,
    monthDifferenceCents,
    monthState,
    previousDaysSpentCents,
    previousDaysBudgetCents,
    previousDaysCarryoverCents,
    remainingDaysAfterToday,
    remainingDaysIncludingToday,
    remainingBudgetAfterTodayCents,
    plannedBudgetIncludingTodayCents,
    totalAvailableThroughMonthEndCents,
    recommendedDailyAverageCents,
    adjustmentCents,
    currency,
  };
}

function budgetMoney(cents: number, currency: BudgetCurrency) {
  const symbols: Record<BudgetCurrency, string> = {
    EUR: "€",
    USD: "$",
    CAD: "C$",
    GBP: "£",
  };
  return `${symbols[currency]}${(Math.abs(cents) / 100).toFixed(2)}`;
}

function localizedDate(todayKey: string, language: TelegramLanguage) {
  const locale =
    language === "fa"
      ? "fa-IR-u-ca-gregory"
      : language === "nl"
        ? "nl-NL"
        : "en-GB";
  return new Intl.DateTimeFormat(locale, {
    timeZone: TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${todayKey}T12:00:00.000Z`));
}

export function telegramDateText(
  language: TelegramLanguage = "en",
  now = new Date(),
) {
  const date = localizedDate(budgetDateKey(now), language);
  if (language === "fa") return `📆 امروز · ${date}`;
  if (language === "nl") return `📆 Vandaag · ${date}`;
  return `📆 Today · ${date}`;
}

export function budgetTelegramText(
  status: BudgetStatus,
  language: TelegramLanguage = "en",
) {
  const dateLine = telegramDateText(
    language,
    new Date(`${status.todayKey}T12:00:00.000Z`),
  );
  const format = (cents: number) => budgetMoney(cents, status.currency);
  const total = format(status.totalAvailableThroughMonthEndCents);
  const totalDisplay =
    status.totalAvailableThroughMonthEndCents < 0 ? `−${total}` : total;
  const future = format(status.remainingBudgetAfterTodayCents);
  const todayDifference = format(status.dailyDifferenceCents);
  const adjustment = format(status.adjustmentCents);
  const signed = (cents: number) => `${cents >= 0 ? "+" : "−"}${format(cents)}`;
  const equation = [
    future,
    signed(status.dailyDifferenceCents),
    signed(status.previousDaysCarryoverCents),
    status.adjustmentCents ? signed(status.adjustmentCents) : "",
  ]
    .filter(Boolean)
    .join(" ");
  const showAverage = status.remainingDaysAfterToday > 0;

  if (language === "fa") {
    const daily =
      status.dailyState === "neutral"
        ? `⚪ امروز هنوز هزینه‌ای ثبت نشده است · ${format(status.dailyBudgetCents)} برای امروز در دسترس است.`
        : status.dailyState === "under"
          ? `🟢 امروز: ${format(status.todaySpentCents)} خرج شده · ${todayDifference} برای امروز باقی مانده است.`
          : `🔴 امروز: ${format(status.todaySpentCents)} خرج شده · ${todayDifference} بیشتر از سقف ${format(status.dailyBudgetCents)} امروز.`;
    const remaining = `📅 بعد از امروز: ${status.remainingDaysAfterToday} روز باقی مانده · ${future} با بودجهٔ روزانهٔ فعلی ${format(status.dailyBudgetCents)}.`;
    const carryoverLine = `↪️ باقی‌مانده از روزهای قبل: ${signed(status.previousDaysCarryoverCents)}.`;
    const totalLine = status.remainingDaysAfterToday === 0
      ? `💰 نتیجهٔ نهایی ماه: ${signed(status.totalAvailableThroughMonthEndCents)}.`
      : `💰 کل مبلغ در دسترس تا پایان ماه: ${equation} = ${totalDisplay}.`;
    const adjustmentLine = status.adjustmentCents
      ? `⚙️ تعدیل بودجه توسط Owner: ${status.adjustmentCents > 0 ? "+" : "−"}${adjustment}.`
      : "";
    const average = showAverage
      ? status.totalAvailableThroughMonthEndCents < 0
        ? `⚠️ بودجه تا پایان ماه ${total} منفی است؛ تا جبران اضافه‌خرج، میانگین پیشنهادی روزانه ${format(0)} است.`
        : `💡 از فردا، مبلغ ${total} را میان ${status.remainingDaysAfterToday} روز باقی‌مانده تقسیم کنید: به‌طور میانگین حداکثر ${format(status.recommendedDailyAverageCents)} در روز.`
      : "";
    return [dateLine, daily, carryoverLine, remaining, adjustmentLine, totalLine, average]
      .filter(Boolean)
      .join("\n");
  }

  if (language === "nl") {
    const daily =
      status.dailyState === "neutral"
        ? `⚪ Vandaag is nog geen uitgave geregistreerd · ${format(status.dailyBudgetCents)} is vandaag beschikbaar.`
        : status.dailyState === "under"
          ? `🟢 Vandaag: ${format(status.todaySpentCents)} uitgegeven · ${todayDifference} vandaag beschikbaar.`
          : `🔴 Vandaag: ${format(status.todaySpentCents)} uitgegeven · ${todayDifference} boven de daglimiet van ${format(status.dailyBudgetCents)}.`;
    const remaining = `📅 Na vandaag: nog ${status.remainingDaysAfterToday} dagen · ${future} gepland met het huidige dagbudget van ${format(status.dailyBudgetCents)}.`;
    const carryoverLine = `↪️ Meegenomen saldo van eerdere dagen: ${signed(status.previousDaysCarryoverCents)}.`;
    const totalLine = status.remainingDaysAfterToday === 0
      ? `💰 Eindresultaat van de maand: ${signed(status.totalAvailableThroughMonthEndCents)}.`
      : `💰 Totaal beschikbaar tot het einde van de maand: ${equation} = ${totalDisplay}.`;
    const adjustmentLine = status.adjustmentCents
      ? `⚙️ Budgetaanpassing door de eigenaar: ${status.adjustmentCents > 0 ? "+" : "−"}${adjustment}.`
      : "";
    const average = showAverage
      ? status.totalAvailableThroughMonthEndCents < 0
        ? `⚠️ Het budget tot het einde van de maand is ${total} negatief; het aanbevolen daggemiddelde is ${format(0)} totdat de overschrijding is hersteld.`
        : `💡 Verdeel vanaf morgen ${total} over de resterende ${status.remainingDaysAfterToday} dagen: gemiddeld maximaal ${format(status.recommendedDailyAverageCents)} per dag.`
      : "";
    return [dateLine, daily, carryoverLine, remaining, adjustmentLine, totalLine, average]
      .filter(Boolean)
      .join("\n");
  }

  const daily =
    status.dailyState === "neutral"
      ? `⚪ No expense has been logged today yet · ${format(status.dailyBudgetCents)} is available today.`
      : status.dailyState === "under"
        ? `🟢 Today: ${format(status.todaySpentCents)} spent · ${todayDifference} available today.`
        : `🔴 Today: ${format(status.todaySpentCents)} spent · ${todayDifference} above today's ${format(status.dailyBudgetCents)} limit.`;
  const remaining = `📅 After today: ${status.remainingDaysAfterToday} days remain · ${future} planned at the current ${format(status.dailyBudgetCents)} daily budget.`;
  const carryoverLine = `↪️ Balance carried from previous days: ${signed(status.previousDaysCarryoverCents)}.`;
  const totalLine = status.remainingDaysAfterToday === 0
    ? `💰 Final result for the month: ${signed(status.totalAvailableThroughMonthEndCents)}.`
    : `💰 Total available through month end: ${equation} = ${totalDisplay}.`;
  const adjustmentLine = status.adjustmentCents
    ? `⚙️ Owner budget adjustment: ${status.adjustmentCents > 0 ? "+" : "−"}${adjustment}.`
    : "";
  const average = showAverage
    ? status.totalAvailableThroughMonthEndCents < 0
      ? `⚠️ The budget through month end is ${total} negative; the recommended daily average is ${format(0)} until the overspend is recovered.`
      : `💡 From tomorrow, divide ${total} across the remaining ${status.remainingDaysAfterToday} days: an average of no more than ${format(status.recommendedDailyAverageCents)} per day.`
    : "";
  return [dateLine, daily, carryoverLine, remaining, adjustmentLine, totalLine, average]
    .filter(Boolean)
    .join("\n");
}

export function budgetMonthlySummaryText(
  status: BudgetStatus,
  language: TelegramLanguage = "en",
) {
  if (language === "fa") {
    return [
      "📅 خلاصهٔ ماهانه",
      `هزینهٔ ثبت‌شده از اول این ماه: ${budgetMoney(status.monthSpentCents, status.currency)}`,
      budgetTelegramText(status, language),
    ].join("\n");
  }

  if (language === "nl") {
    return [
      "📅 Maandoverzicht",
      `Geregistreerd sinds het begin van deze maand: ${budgetMoney(status.monthSpentCents, status.currency)}`,
      budgetTelegramText(status, language),
    ].join("\n");
  }

  return [
    "📅 Monthly summary",
    `Recorded since the start of this month: ${budgetMoney(status.monthSpentCents, status.currency)}`,
    budgetTelegramText(status, language),
  ].join("\n");
}
