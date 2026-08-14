import type { DashboardData } from "./types";
import type { Transaction } from "./types";

const today = new Date();
const date = (offset: number) => {
  const value = new Date(today);
  value.setDate(today.getDate() + offset);
  return value.toISOString();
};

const demoNames = [
  ["Alex", "Jordan"],
  ["Sam", "Riley"],
  ["Noah", "Avery"],
  ["Mila", "Robin"],
];

export function createDemoData(): DashboardData {
  const [ownerName, memberName] =
    demoNames[Math.floor(Math.random() * demoNames.length)];
  const randomAmount = (minimum: number, maximum: number) =>
    Math.round((minimum + Math.random() * (maximum - minimum)) * 100);
  const ownerId = "demo-owner";
  const memberId = "demo-member";
  const expense = (
    id: string,
    idOfMember: string,
    minimum: number,
    maximum: number,
    category: string,
    note: string,
    source: Transaction["source"],
    offset: number,
  ): Transaction => {
    const amountCents = randomAmount(minimum, maximum);
    return {
      id,
      memberId: idOfMember,
      amountCents,
      baseAmountCents: amountCents,
      currency: "EUR",
      category,
      note,
      type: "expense",
      source,
      happenedAt: date(offset),
    };
  };
  const demoTransactions: Transaction[] = [
    expense("t1", ownerId, 12, 32, "Groceries", "Weekly groceries", "web", 0),
    expense("t2", memberId, 8, 24, "Dining", "Lunch together", "telegram", -1),
    expense("t3", ownerId, 5, 18, "Transport", "Train tickets", "telegram", -3),
    expense("t4", memberId, 25, 65, "Home", "Household supplies", "web", -6),
    expense("t5", ownerId, 10, 30, "Leisure", "Weekend activity", "web", -10),
  ];

  return {
    household: {
      id: "demo-household",
      name: "Sample Family Home",
      kind: "family",
      baseCurrency: "EUR",
      city: "Hengelo",
      budgetAdjustmentCents: 0,
      budgetAdjustmentMonth: null,
      setupCompletedAt: new Date().toISOString(),
    },
    budgetAdjustmentCents: 0,
    monthlyBudgetAdjustments: [],
    dailyBudgetRules: [
      {
        effectiveDate: "2026-08-11",
        dailyBudgetCents: 2_000,
      },
    ],
    currentMemberId: ownerId,
    members: [
      {
        id: ownerId,
        name: ownerName,
        email: "owner@example.com",
        color: "#1d6b5a",
        role: "owner",
        canViewHousehold: true,
        status: "active",
        telegramLinkCode: "DEMOOWNER",
        joinedAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
      },
      {
        id: memberId,
        name: memberName,
        email: "member@example.com",
        color: "#e2764f",
        role: "member",
        canViewHousehold: true,
        status: "active",
        telegramLinkCode: "DEMOMEMBER",
        joinedAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
      },
    ],
    membershipRequests: [],
    categories: [],
    auditLogs: [],
    transactions: demoTransactions,
    familyBudgetTransactions: demoTransactions.map((item) => ({
      id: item.id,
      type: item.type,
      baseAmountCents: item.baseAmountCents,
      happenedAt: item.happenedAt,
    })),
  };
}

export const demoData = createDemoData();
