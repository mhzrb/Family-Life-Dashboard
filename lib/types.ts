export type Member = {
  id: string;
  name: string;
  email: string;
  color: string;
  role: string;
  status: "active" | "removed";
  telegramLinkCode: string;
  telegramLinkCodeExpiresAt?: string | null;
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
  household: { id: string; name: string; kind: string; baseCurrency: string; city: string };
  currentMemberId: string;
  members: Member[];
  transactions: Transaction[];
  membershipRequests: MembershipRequest[];
  categories: Array<{ id: string; name: string }>;
  auditLogs: Array<{ id: string; action: string; summary: string; actorName: string; createdAt: string }>;
};
