// Pure date logic — deliberately has NO imports (no "server-only", no
// prisma) so it can be unit-tested directly. session.ts (which does the
// actual Prisma lookups) imports this.

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * A Date's local calendar date (year/month/day), represented as UTC midnight
 * of that date. This — not `startOfToday()` — is what must be written to or
 * compared against a `@db.Date` column: Postgres has no timezone, so Prisma
 * serializes a Date to one by taking its UTC calendar date. `startOfToday()`
 * is local midnight, which in a positive-UTC-offset timezone (this system
 * runs in Asia/Bangkok, UTC+7) is still the *previous* day in UTC — so
 * writing it straight to a `@db.Date` column silently lands one day early,
 * colliding with the row for yesterday instead of creating today's. Always
 * route a Date through this before it touches a `@db.Date` column.
 */
export function toDateOnlyKey(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

/**
 * Whether a closed session's anchor date is recent enough to still be
 * treated as "the current session" — i.e. today, or yesterday (covers
 * closing the register just after midnight, where the session's date is
 * still yesterday's check-in day). A session older than that is stale: a
 * genuinely new day has started since, and pretending it's still "current"
 * is what caused a real bug — the dashboard showing "Sudah Check-in" for a
 * pramuniaga who hadn't checked in for days, because the last (long-closed)
 * session kept winning the fallback with no recency cutoff.
 *
 * `date` comes back from a `@db.Date` column (UTC midnight of a calendar
 * date), so it's compared against `toDateOnlyKey`, not local midnight.
 */
export function isRecentEnoughToStillBeCurrent(date: Date, now: Date = new Date()): boolean {
  const today = toDateOnlyKey(now);
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return date.getTime() === today.getTime() || date.getTime() === yesterday.getTime();
}
