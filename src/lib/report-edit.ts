import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * A pramuniaga may revise their own PENDING or REJECTED/REVISION report for
 * any past date — never an APPROVED one, which SPV has already signed off
 * on. Given a requested date, returns that date only if it resolves to such
 * an editable report for this outlet+pramuniaga; otherwise null, so the
 * caller falls back to the live session date instead of trusting an
 * arbitrary client-supplied date.
 */
export async function resolveEditableReportDate(
  outletId: string,
  pramuniagaId: string,
  requestedDate: Date | null | undefined,
): Promise<Date | null> {
  if (!requestedDate) return null;
  const report = await prisma.dailyReport.findUnique({
    where: { outletId_pramuniagaId_date: { outletId, pramuniagaId, date: requestedDate } },
  });
  if (!report || report.status === "APPROVED") return null;
  return requestedDate;
}

/** Parses a plain "YYYY-MM-DD" query-param string into a `@db.Date`-safe UTC
 * midnight, or null if malformed — never trust `new Date(str)` here since a
 * bare date string is parsed as local time in some engines. */
export function parseDateOnlyParam(value: string | undefined | null): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
}
