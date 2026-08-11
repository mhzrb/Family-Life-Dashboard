import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { apiRateLimits, auditLogs } from "../db/schema";

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) return false;
  return !origin || origin === new URL(request.url).origin;
}

export function safeIsoDate(value: unknown, fallback = new Date()) {
  if (typeof value !== "string" || !value) return fallback.toISOString();
  const parsed = new Date(value);
  const min = new Date("2000-01-01T00:00:00.000Z").getTime();
  const max = Date.now() + 24 * 60 * 60 * 1000;
  return Number.isFinite(parsed.getTime()) && parsed.getTime() >= min && parsed.getTime() <= max
    ? parsed.toISOString()
    : null;
}

export async function enforceRateLimit(key: string, limit: number, windowMs = 60_000) {
  const db = await getDb();
  const now = Date.now();
  const [row] = await db.select().from(apiRateLimits).where(eq(apiRateLimits.key, key)).limit(1);
  if (!row || now - row.windowStartedAt >= windowMs) {
    await db.insert(apiRateLimits).values({ key, windowStartedAt: now, requestCount: 1, updatedAt: new Date(now).toISOString() })
      .onConflictDoUpdate({ target: apiRateLimits.key, set: { windowStartedAt: now, requestCount: 1, updatedAt: new Date(now).toISOString() } });
    return { allowed: true, retryAfter: 0 };
  }
  if (row.requestCount >= limit) return { allowed: false, retryAfter: Math.max(1, Math.ceil((windowMs - (now - row.windowStartedAt)) / 1000)) };
  await db.update(apiRateLimits).set({ requestCount: row.requestCount + 1, updatedAt: new Date(now).toISOString() }).where(eq(apiRateLimits.key, key));
  return { allowed: true, retryAfter: 0 };
}

export async function writeAudit(entry: {
  householdId: string;
  actorMemberId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
}) {
  const db = await getDb();
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    householdId: entry.householdId,
    actorMemberId: entry.actorMemberId ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    summary: entry.summary.slice(0, 240),
    createdAt: new Date().toISOString(),
  });
}

export function secureJson(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "no-referrer");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  return Response.json(data, { ...init, headers });
}
