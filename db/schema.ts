import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const households = sqliteTable("households", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("family"),
  baseCurrency: text("base_currency").notNull().default("EUR"),
  city: text("city").notNull().default("Hengelo"),
  createdAt: text("created_at").notNull(),
});

export const members = sqliteTable(
  "members",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id").notNull(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    nameKey: text("name_key"),
    color: text("color").notNull().default("#1f6f5f"),
    role: text("role").notNull().default("member"),
    status: text("status").notNull().default("active"),
    telegramLinkCode: text("telegram_link_code").notNull(),
    telegramLinkCodeExpiresAt: text("telegram_link_code_expires_at"),
    createdAt: text("created_at").notNull(),
    removedAt: text("removed_at"),
  },
  (table) => [
    index("members_email_idx").on(table.email),
    index("members_household_idx").on(table.householdId),
    uniqueIndex("members_household_name_uidx").on(table.householdId, table.nameKey),
  ],
);

export const membershipRequests = sqliteTable(
  "membership_requests",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id").notNull(),
    action: text("action").notNull(),
    targetMemberId: text("target_member_id").notNull(),
    targetName: text("target_name").notNull(),
    targetEmail: text("target_email").notNull(),
    requestedByMemberId: text("requested_by_member_id").notNull(),
    requiredApprovals: integer("required_approvals").notNull(),
    status: text("status").notNull().default("pending"),
    createdAt: text("created_at").notNull(),
    resolvedAt: text("resolved_at"),
  },
  (table) => [
    index("membership_requests_household_status_idx").on(table.householdId, table.status),
    index("membership_requests_target_idx").on(table.targetMemberId),
  ],
);

export const membershipApprovals = sqliteTable(
  "membership_approvals",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id").notNull(),
    memberId: text("member_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("membership_approvals_request_member_uidx").on(table.requestId, table.memberId),
    index("membership_approvals_request_idx").on(table.requestId),
  ],
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id").notNull(),
    memberId: text("member_id").notNull(),
    amountCents: integer("amount_cents").notNull(),
    baseAmountCents: integer("base_amount_cents").notNull(),
    currency: text("currency").notNull().default("EUR"),
    category: text("category").notNull(),
    note: text("note").notNull(),
    type: text("type").notNull().default("expense"),
    source: text("source").notNull().default("web"),
    telegramUpdateId: text("telegram_update_id"),
    happenedAt: text("happened_at").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at"),
    deletedAt: text("deleted_at"),
  },
  (table) => [
    index("transactions_household_date_idx").on(
      table.householdId,
      table.happenedAt,
    ),
    index("transactions_member_idx").on(table.memberId),
    uniqueIndex("transactions_telegram_update_uidx").on(table.telegramUpdateId),
  ],
);

export const telegramLinks = sqliteTable(
  "telegram_links",
  {
    chatId: text("chat_id").primaryKey(),
    memberId: text("member_id").notNull(),
    householdId: text("household_id").notNull(),
    language: text("language").notNull().default("en"),
    linkedAt: text("linked_at").notNull(),
  },
  (table) => [index("telegram_member_idx").on(table.memberId)],
);

export const telegramBotState = sqliteTable("telegram_bot_state", {
  id: text("id").primaryKey(),
  nextUpdateId: integer("next_update_id").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
});

export const telegramConversationState = sqliteTable("telegram_conversation_state", {
  chatId: text("chat_id").primaryKey(),
  state: text("state").notNull(),
  category: text("category"),
  updatedAt: text("updated_at").notNull(),
});

export const expenseCategories = sqliteTable(
  "expense_categories",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id").notNull(),
    name: text("name").notNull(),
    nameKey: text("name_key").notNull(),
    createdByMemberId: text("created_by_member_id"),
    createdAt: text("created_at").notNull(),
    archivedAt: text("archived_at"),
  },
  (table) => [
    uniqueIndex("expense_categories_household_name_uidx").on(table.householdId, table.nameKey),
    index("expense_categories_household_idx").on(table.householdId),
  ],
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id").notNull(),
    actorMemberId: text("actor_member_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    summary: text("summary").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("audit_logs_household_date_idx").on(table.householdId, table.createdAt)],
);

export const apiRateLimits = sqliteTable("api_rate_limits", {
  key: text("key").primaryKey(),
  windowStartedAt: integer("window_started_at").notNull(),
  requestCount: integer("request_count").notNull(),
  updatedAt: text("updated_at").notNull(),
});
