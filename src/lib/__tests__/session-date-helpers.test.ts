import { isRecentEnoughToStillBeCurrent, toDateOnlyKey } from "@/lib/session-date-helpers";

const NOW = new Date(2026, 7, 10, 14, 30); // 2026-08-10 14:30 local

// Dates as they actually come back from a @db.Date column via Prisma: UTC
// midnight of the calendar date, not local midnight (see toDateOnlyKey).
const dbDate = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));

describe("toDateOnlyKey", () => {
  it("keeps the local calendar date, represented as UTC midnight", () => {
    // NOW is local Aug 10 14:30. In a positive-UTC-offset timezone (this
    // system runs in Asia/Bangkok, UTC+7), naive local-midnight truncation
    // followed by @db.Date serialization would land on UTC Aug 9 17:00 —
    // the wrong calendar day. toDateOnlyKey must keep it as UTC Aug 10.
    expect(toDateOnlyKey(NOW).toISOString()).toBe("2026-08-10T00:00:00.000Z");
  });

  it("is stable regardless of the input Date's time-of-day", () => {
    const morning = new Date(2026, 7, 10, 0, 1);
    const night = new Date(2026, 7, 10, 23, 59);
    expect(toDateOnlyKey(morning).getTime()).toBe(toDateOnlyKey(night).getTime());
  });
});

describe("isRecentEnoughToStillBeCurrent", () => {
  it("treats today's date as current", () => {
    expect(isRecentEnoughToStillBeCurrent(dbDate(2026, 7, 10), NOW)).toBe(true);
  });

  it("treats yesterday's date as current (closing the register just after midnight)", () => {
    expect(isRecentEnoughToStillBeCurrent(dbDate(2026, 7, 9), NOW)).toBe(true);
  });

  it("treats a session from 2+ days ago as stale — the real bug this fixed", () => {
    // A pramuniaga's last closed session was days ago; the dashboard/attendance
    // page must not keep presenting that as "the current session".
    expect(isRecentEnoughToStillBeCurrent(dbDate(2026, 7, 4), NOW)).toBe(false);
    expect(isRecentEnoughToStillBeCurrent(dbDate(2026, 7, 8), NOW)).toBe(false);
  });

  it("treats a future date as not current (defensive — shouldn't happen in practice)", () => {
    expect(isRecentEnoughToStillBeCurrent(dbDate(2026, 7, 11), NOW)).toBe(false);
  });
});
