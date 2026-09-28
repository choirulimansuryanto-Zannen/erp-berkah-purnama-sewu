import "server-only";
import { prisma } from "@/lib/prisma";
import { startOfToday, toDateOnlyKey, isRecentEnoughToStillBeCurrent } from "@/lib/session-date-helpers";

export { startOfToday, toDateOnlyKey, isRecentEnoughToStillBeCurrent };

/**
 * A pramuniaga's "shift session" runs from check-in to check-out and is not
 * bound to a calendar day — closing the register after midnight is still the
 * same session as the check-in. `AttendanceRecord.date` is the session's
 * anchor date (the check-in date), and everything session-scoped (POS
 * defaults, daily report, inventory check, "today" widgets) should key off
 * that instead of `new Date()` truncated to midnight.
 */

/**
 * The user's currently open session (checked in, not yet checked out), if
 * any. Up to Outlet.maxPramuniagaPerShift roster members can now be
 * independently checked in under the same login on the same day (see
 * AttendanceRecord's unique key), so this may not be the only open row —
 * it's picked deterministically as the EARLIEST timeIn among today's opens,
 * so callers that need "the" session's start (getSessionTimeRange) get a
 * window covering the whole team's activity, not just whoever checked in
 * last.
 */
export async function getOpenSession(userId: string) {
  return prisma.attendanceRecord.findFirst({
    where: { userId, timeOut: null },
    orderBy: [{ date: "desc" }, { timeIn: "asc" }],
  });
}

/** Every currently open session for this user (one per checked-in roster member). */
export async function getOpenSessions(userId: string) {
  return prisma.attendanceRecord.findMany({
    where: { userId, timeOut: null },
    orderBy: { timeIn: "asc" },
  });
}

/** The user's most recent session, open or closed. */
export async function getLatestSession(userId: string) {
  return prisma.attendanceRecord.findFirst({
    where: { userId },
    orderBy: [{ date: "desc" }, { timeIn: "desc" }],
  });
}

export async function hasOpenSession(userId: string): Promise<boolean> {
  return (await getOpenSession(userId)) !== null;
}

/**
 * The date to use for all session-scoped pramuniaga operations: the open
 * session's check-in date if one is active AND recent enough (today/
 * yesterday); otherwise the most recent session's date under the same
 * recency rule; otherwise today (no sessions yet, or the last one — open or
 * closed — is genuinely old). An open session gets no free pass on recency:
 * a forgotten check-out from days ago must not keep every "today" view
 * (Riwayat Transaksi, Daily Report's Terjual Sistem, Expenses) pinned to
 * that stale check-in date, silently accumulating days of unrelated POS
 * activity into what's supposed to be today's figures.
 */
export async function getSessionDate(userId: string): Promise<Date> {
  const open = await getOpenSession(userId);
  if (open && isRecentEnoughToStillBeCurrent(open.date)) return open.date;
  const latest = await getLatestSession(userId);
  if (latest && isRecentEnoughToStillBeCurrent(latest.date)) return latest.date;
  return toDateOnlyKey(new Date());
}

/**
 * The actual clock-time window covered by the user's current/latest session
 * — from check-in to check-out (or "now" if still open). Use this instead of
 * calendar-day boundaries when aggregating transactions/expenses so activity
 * after midnight is still attributed to the shift it belongs to. Same
 * recency cutoff as getSessionDate, applied to an open session too — a
 * shift left open for days (forgotten check-out) falls through to `null`
 * here just like a long-closed one would, so callers fall back to
 * `startOfToday()` instead of aggregating since the stale check-in.
 */
export async function getSessionTimeRange(userId: string): Promise<{ from: Date; to: Date } | null> {
  const open = await getOpenSession(userId);
  if (open && isRecentEnoughToStillBeCurrent(open.date)) {
    return { from: open.timeIn ?? open.date, to: new Date() };
  }
  const latest = await getLatestSession(userId);
  if (!latest || !isRecentEnoughToStillBeCurrent(latest.date)) return null;
  return { from: latest.timeIn ?? latest.date, to: latest.timeOut ?? new Date() };
}

/**
 * The clock-time window covered by a *specific past* date's attendance,
 * regardless of recency — used when a pramuniaga is revising an older
 * PENDING/REJECTED report, where `getSessionTimeRange`'s "today/yesterday"
 * cutoff would otherwise return `null` and hide that day's real POS activity.
 * Spans every roster member's check-in on that date (earliest timeIn to
 * latest timeOut, or now if still open) so a multi-person shift is covered
 * in full. Falls back to the whole calendar day if no attendance is on file.
 */
export async function getTimeRangeForDate(userId: string, date: Date): Promise<{ from: Date; to: Date }> {
  const records = await prisma.attendanceRecord.findMany({ where: { userId, date } });
  if (records.length === 0) {
    const to = new Date(date);
    to.setUTCDate(to.getUTCDate() + 1);
    return { from: date, to };
  }
  const now = new Date();
  const from = records.reduce<Date>((min, r) => {
    const t = r.timeIn ?? date;
    return t < min ? t : min;
  }, records[0].timeIn ?? date);
  const to = records.reduce<Date>((max, r) => {
    const t = r.timeOut ?? now;
    return t > max ? t : max;
  }, records[0].timeOut ?? now);
  return { from, to };
}
