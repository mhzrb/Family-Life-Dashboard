import type { Transaction } from "./types";

export const DAILY_FAMILY_BUDGET_CENTS = 2_000;
export const BUDGET_START_DATE = "2026-08-11";
const TIME_ZONE = "Europe/Amsterdam";

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
  remainingBudgetAfterTodayCents: number;
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
  const dailyDifferenceCents =
    DAILY_FAMILY_BUDGET_CENTS - todaySpentCents;
  const monthToDateBudgetCents =
    elapsedActiveDays * DAILY_FAMILY_BUDGET_CENTS;
  const fullMonthBudgetCents =
    activeDaysInMonth * DAILY_FAMILY_BUDGET_CENTS;
  const remainingBudgetAfterTodayCents =
    remainingDaysAfterToday * DAILY_FAMILY_BUDGET_CENTS;
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
    remainingBudgetAfterTodayCents,
  };
}

export function budgetTelegramText(status: BudgetStatus) {
  const euro = (cents: number) =>
    `€${(Math.abs(cents) / 100).toFixed(2)}`;
  const daily =
    status.dailyState === "neutral"
      ? `⚪ No expense has been logged today yet. ${euro(status.dailyBudgetCents)} is available today.`
      : status.dailyState === "under"
        ? `🟢 Today: ${euro(status.todaySpentCents)} spent · ${euro(status.dailyDifferenceCents)} available today.`
        : `🔴 Today: ${euro(status.todaySpentCents)} spent · ${euro(status.dailyDifferenceCents)} above today's €20.00 limit.`;
  const remaining = `📅 After today: ${status.remainingDaysAfterToday} days remain · ${euro(status.remainingBudgetAfterTodayCents)} planned at €20.00 per day.`;

  const totalAvailableCents =
    status.remainingBudgetAfterTodayCents + status.dailyDifferenceCents;
  const operator = status.dailyDifferenceCents >= 0 ? "+" : "−";
  const total =
    totalAvailableCents >= 0
      ? `💶 Total available through month end: ${euro(status.remainingBudgetAfterTodayCents)} ${operator} ${euro(status.dailyDifferenceCents)} = ${euro(totalAvailableCents)}.`
      : `🔴 Month-end plan exceeded: ${euro(status.remainingBudgetAfterTodayCents)} ${operator} ${euro(status.dailyDifferenceCents)} = −${euro(totalAvailableCents)}.`;

  return `${daily}\n${remaining}\n${total}`;
}
