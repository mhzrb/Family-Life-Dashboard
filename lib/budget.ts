import type { Transaction } from "./types";

export const DAILY_FAMILY_BUDGET_CENTS = 2_000;
export const BUDGET_START_DATE = "2026-08-11";
const TIME_ZONE = "Europe/Amsterdam";

export type TelegramLanguage = "en" | "nl" | "fa";

function dateKey(value: Date | string) {
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

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
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
  remainingDaysAfterToday: number;
  remainingDaysIncludingToday: number;
  remainingBudgetAfterTodayCents: number;
  plannedBudgetIncludingTodayCents: number;
  totalAvailableThroughMonthEndCents: number;
  recommendedDailyAverageCents: number;
};

export function calculateBudgetStatus(
  transactions: Pick<
    Transaction,
    "type" | "baseAmountCents" | "happenedAt"
  >[],
  now = new Date(),
): BudgetStatus {
  const todayKey = dateKey(now);
  const [year, month, day] = todayKey.split("-").map(Number);
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}-`;
  const monthStart = `${monthPrefix}01`;
  const effectiveStart =
    BUDGET_START_DATE > monthStart && BUDGET_START_DATE.startsWith(monthPrefix)
      ? BUDGET_START_DATE
      : monthStart;
  const startDay = Number(effectiveStart.slice(-2));
  const activeToday = todayKey >= BUDGET_START_DATE;
  const monthLength = daysInMonth(year, month);

  const eligible = transactions.filter((item) => {
    const itemDate = dateKey(item.happenedAt);
    return (
      item.type === "expense" &&
      itemDate >= effectiveStart &&
      itemDate.startsWith(monthPrefix)
    );
  });

  const todaySpentCents = eligible
    .filter((item) => dateKey(item.happenedAt) === todayKey)
    .reduce((sum, item) => sum + item.baseAmountCents, 0);
  const monthSpentCents = eligible.reduce(
    (sum, item) => sum + item.baseAmountCents,
    0,
  );
  const elapsedActiveDays = activeToday
    ? Math.max(0, day - startDay + 1)
    : 0;
  const activeDaysInMonth = Math.max(0, monthLength - startDay + 1);
  const remainingDaysAfterToday = activeToday
    ? Math.max(0, monthLength - day)
    : activeDaysInMonth;
  const remainingDaysIncludingToday = activeToday
    ? remainingDaysAfterToday + 1
    : remainingDaysAfterToday;
  const dailyDifferenceCents =
    DAILY_FAMILY_BUDGET_CENTS - todaySpentCents;
  const monthToDateBudgetCents =
    elapsedActiveDays * DAILY_FAMILY_BUDGET_CENTS;
  const fullMonthBudgetCents =
    activeDaysInMonth * DAILY_FAMILY_BUDGET_CENTS;
  const remainingBudgetAfterTodayCents =
    remainingDaysAfterToday * DAILY_FAMILY_BUDGET_CENTS;
  const plannedBudgetIncludingTodayCents =
    remainingDaysIncludingToday * DAILY_FAMILY_BUDGET_CENTS;
  const totalAvailableThroughMonthEndCents = activeToday
    ? remainingBudgetAfterTodayCents + dailyDifferenceCents
    : remainingBudgetAfterTodayCents;
  const recommendedDailyAverageCents = remainingDaysIncludingToday
    ? Math.max(
        0,
        Math.floor(
          totalAvailableThroughMonthEndCents / remainingDaysIncludingToday,
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
    dailyBudgetCents: DAILY_FAMILY_BUDGET_CENTS,
    dailyDifferenceCents,
    dailyState,
    monthSpentCents,
    monthToDateBudgetCents,
    fullMonthBudgetCents,
    monthDifferenceCents,
    monthState,
    remainingDaysAfterToday,
    remainingDaysIncludingToday,
    remainingBudgetAfterTodayCents,
    plannedBudgetIncludingTodayCents,
    totalAvailableThroughMonthEndCents,
    recommendedDailyAverageCents,
  };
}

function euro(cents: number) {
  return `€${(Math.abs(cents) / 100).toFixed(2)}`;
}

export function budgetTelegramText(
  status: BudgetStatus,
  language: TelegramLanguage = "en",
) {
  const operator = status.dailyDifferenceCents >= 0 ? "+" : "−";
  const total = euro(status.totalAvailableThroughMonthEndCents);
  const future = euro(status.remainingBudgetAfterTodayCents);
  const todayDifference = euro(status.dailyDifferenceCents);
  const showAverage =
    status.remainingDaysIncludingToday > 0 &&
    status.totalAvailableThroughMonthEndCents <
      status.plannedBudgetIncludingTodayCents;

  if (language === "fa") {
    const daily =
      status.dailyState === "neutral"
        ? `⚪ امروز هنوز هزینه‌ای ثبت نشده است · ${euro(status.dailyBudgetCents)} برای امروز در دسترس است.`
        : status.dailyState === "under"
          ? `🟢 امروز: ${euro(status.todaySpentCents)} خرج شده · ${todayDifference} برای امروز باقی مانده است.`
          : `🔴 امروز: ${euro(status.todaySpentCents)} خرج شده · ${todayDifference} بیشتر از سقف €20.00 امروز.`;
    const remaining = `📅 بعد از امروز: ${status.remainingDaysAfterToday} روز باقی مانده · ${future} با برنامهٔ روزانهٔ €20.00.`;
    const totalLine = `💶 کل مبلغ در دسترس تا پایان ماه: ${future} ${operator} ${todayDifference} = ${total}.`;
    const average = showAverage
      ? `💡 برای ماندن در برنامه، در ${status.remainingDaysIncludingToday} روز باقی‌مانده به‌طور میانگین حداکثر ${euro(status.recommendedDailyAverageCents)} در روز خرج کنید.`
      : "";
    return [daily, remaining, totalLine, average].filter(Boolean).join("\n");
  }

  if (language === "nl") {
    const daily =
      status.dailyState === "neutral"
        ? `⚪ Vandaag is nog geen uitgave geregistreerd · ${euro(status.dailyBudgetCents)} is vandaag beschikbaar.`
        : status.dailyState === "under"
          ? `🟢 Vandaag: ${euro(status.todaySpentCents)} uitgegeven · ${todayDifference} vandaag beschikbaar.`
          : `🔴 Vandaag: ${euro(status.todaySpentCents)} uitgegeven · ${todayDifference} boven de daglimiet van €20.00.`;
    const remaining = `📅 Na vandaag: nog ${status.remainingDaysAfterToday} dagen · ${future} gepland met €20.00 per dag.`;
    const totalLine = `💶 Totaal beschikbaar tot het einde van de maand: ${future} ${operator} ${todayDifference} = ${total}.`;
    const average = showAverage
      ? `💡 Om binnen het plan te blijven, besteed je de resterende ${status.remainingDaysIncludingToday} dagen gemiddeld maximaal ${euro(status.recommendedDailyAverageCents)} per dag.`
      : "";
    return [daily, remaining, totalLine, average].filter(Boolean).join("\n");
  }

  const daily =
    status.dailyState === "neutral"
      ? `⚪ No expense has been logged today yet · ${euro(status.dailyBudgetCents)} is available today.`
      : status.dailyState === "under"
        ? `🟢 Today: ${euro(status.todaySpentCents)} spent · ${todayDifference} available today.`
        : `🔴 Today: ${euro(status.todaySpentCents)} spent · ${todayDifference} above today's €20.00 limit.`;
  const remaining = `📅 After today: ${status.remainingDaysAfterToday} days remain · ${future} planned at €20.00 per day.`;
  const totalLine = `💶 Total available through month end: ${future} ${operator} ${todayDifference} = ${total}.`;
  const average = showAverage
    ? `💡 To stay within plan, spend an average of no more than ${euro(status.recommendedDailyAverageCents)} per day over the remaining ${status.remainingDaysIncludingToday} days.`
    : "";
  return [daily, remaining, totalLine, average].filter(Boolean).join("\n");
}

export function budgetMonthlySummaryText(
  status: BudgetStatus,
  language: TelegramLanguage = "en",
) {
  const difference = status.fullMonthBudgetCents - status.monthSpentCents;

  if (language === "fa") {
    return [
      "📅 خلاصهٔ ماهانه",
      `هزینهٔ ثبت‌شده: ${euro(status.monthSpentCents)}`,
      `برنامهٔ این ماه: ${euro(status.fullMonthBudgetCents)}`,
      difference >= 0
        ? `وضعیت: ${euro(difference)} کمتر از برنامه`
        : `وضعیت: ${euro(difference)} بیشتر از برنامه`,
    ].join("\n");
  }

  if (language === "nl") {
    return [
      "📅 Maandoverzicht",
      `Geregistreerde uitgaven: ${euro(status.monthSpentCents)}`,
      `Maandplan: ${euro(status.fullMonthBudgetCents)}`,
      `Status: ${euro(difference)} ${difference >= 0 ? "onder" : "boven"} het plan`,
    ].join("\n");
  }

  return [
    "📅 Monthly summary",
    `Recorded spending: ${euro(status.monthSpentCents)}`,
    `Monthly plan: ${euro(status.fullMonthBudgetCents)}`,
    `Status: ${euro(difference)} ${difference >= 0 ? "under" : "over"} plan`,
  ].join("\n");
}
