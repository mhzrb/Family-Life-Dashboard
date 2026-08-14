export type Member = {
  id: string;
  name: string;
  email: string;
  color: string;
  role: string;
  canViewHousehold: boolean;
  status: "active" | "removed";
  telegramLinkCode: string;
  telegramLinkCodeExpiresAt?: string | null;
  joinedAt?: string | null;
  lastSeenAt?: string | null;
};

export type MembershipRequest = {
  id: string;
  action: "add" | "remove";
  targetMemberId: string;
  targetName: string;
  targetEmail: string;
  requestedByName: string;
  approvals: number;
  requiredApprovals: number;
  currentMemberApproved: boolean;
  canApprove: boolean;
  createdAt: string;
};

export type Transaction = {
  id: string;
  memberId: string;
  amountCents: number;
  baseAmountCents: number;
  currency: string;
  category: string;
  note: string;
  type: "expense" | "income";
  source: "web" | "telegram";
  happenedAt: string;
};

export type DashboardData = {
  household: {
    id: string;
    name: string;
    kind: string;
    baseCurrency: string;
    city: string;
    budgetAdjustmentCents: number;
    budgetAdjustmentMonth?: string | null;
  };
  budgetAdjustmentCents: number;
  currentMemberId: string;
  members: Member[];
  transactions: Transaction[];
  familyBudgetTransactions: Array<
    Pick<Transaction, "id" | "type" | "baseAmountCents" | "happenedAt">
  >;
  membershipRequests: MembershipRequest[];
  categories: Array<{ id: string; name: string }>;
  auditLogs: Array<{ id: string; action: string; summary: string; actorName: string; createdAt: string }>;
};
