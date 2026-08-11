import type { DashboardData } from "./types";

const today = new Date();
const date = (offset: number) => {
  const value = new Date(today);
  value.setDate(today.getDate() + offset);
  return value.toISOString();
};

export const demoData: DashboardData = {
  household: {
    id: "demo-household",
    name: "The Zokaee Home",
    kind: "family",
    baseCurrency: "EUR",
    city: "Hengelo",
  },
  currentMemberId: "mahsa",
  members: [
    {
      id: "mahsa",
      name: "Mahsa",
      email: "mahsa@example.com",
      color: "#1d6b5a",
      role: "owner",
      status: "active",
      telegramLinkCode: "MAHSA8",
    },
    {
      id: "mohammad",
      name: "Mohammad",
      email: "mohammad@example.com",
      color: "#e2764f",
      role: "member",
      status: "active",
      telegramLinkCode: "MOHAM4",
    },
  ],
  membershipRequests: [],
  categories: [],
  auditLogs: [],
  transactions: [
    { id: "t1", memberId: "mahsa", amountCents: 6840, baseAmountCents: 6840, currency: "EUR", category: "Groceries", note: "Albert Heijn", type: "expense", source: "web", happenedAt: date(0) },
    { id: "t2", memberId: "mohammad", amountCents: 3200, baseAmountCents: 3200, currency: "EUR", category: "Dining", note: "Lunch together", type: "expense", source: "telegram", happenedAt: date(-1) },
    { id: "t3", memberId: "mahsa", amountCents: 2420, baseAmountCents: 2420, currency: "EUR", category: "Transport", note: "NS train", type: "expense", source: "telegram", happenedAt: date(-2) },
    { id: "t4", memberId: "mohammad", amountCents: 8990, baseAmountCents: 8990, currency: "EUR", category: "Home", note: "Kitchen shelves", type: "expense", source: "web", happenedAt: date(-4) },
    { id: "t5", memberId: "mahsa", amountCents: 4700, baseAmountCents: 4700, currency: "EUR", category: "Health", note: "Insurance", type: "expense", source: "web", happenedAt: date(-6) },
    { id: "t6", memberId: "mohammad", amountCents: 1640, baseAmountCents: 1640, currency: "EUR", category: "Groceries", note: "Weekend market", type: "expense", source: "telegram", happenedAt: date(-8) },
    { id: "t7", memberId: "mahsa", amountCents: 12000, baseAmountCents: 12000, currency: "EUR", category: "Leisure", note: "The Hague day trip", type: "expense", source: "web", happenedAt: date(-11) },
    { id: "t8", memberId: "mohammad", amountCents: 5400, baseAmountCents: 5400, currency: "EUR", category: "Groceries", note: "Weekly groceries", type: "expense", source: "web", happenedAt: date(-14) },
    { id: "t9", memberId: "mahsa", amountCents: 1990, baseAmountCents: 1990, currency: "EUR", category: "Dining", note: "Coffee with friends", type: "expense", source: "telegram", happenedAt: date(-17) },
    { id: "t10", memberId: "mohammad", amountCents: 6200, baseAmountCents: 6200, currency: "EUR", category: "Home", note: "Household supplies", type: "expense", source: "web", happenedAt: date(-21) },
  ],
};
