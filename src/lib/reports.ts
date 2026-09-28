import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Aggregates a pramuniaga's omset/non-tunai/potongan/expenses for one shift
 * session. Transactions are summed over the session's actual clock-time
 * window (`from`..`to`) so activity past midnight still counts toward the
 * shift it belongs to — see `getSessionTimeRange` in `@/lib/session`.
 * Expenses key off `ExpenseRecord.date`, a plain calendar-date column that
 * the expense API stamps with the session's anchor date (`sessionDate`),
 * so they're matched by that date rather than by clock time.
 */
export async function computeDailyPreview(
  outletId: string,
  pramuniagaId: string,
  range: { from: Date; to: Date; sessionDate: Date },
) {
  const { from, to, sessionDate } = range;
  // sessionDate is already a @db.Date-safe date-only key (UTC midnight of
  // the session's calendar date — see toDateOnlyKey), so it *is* the day
  // start; local setHours() here would shift it by the UTC offset instead
  // of leaving it alone.
  const sessionDayStart = sessionDate;
  const sessionDayEnd = new Date(sessionDayStart);
  sessionDayEnd.setUTCDate(sessionDayEnd.getUTCDate() + 1);

  const [totalAgg, nonTunaiAgg, discountAgg, expenseAgg] = await Promise.all([
    prisma.transaction.aggregate({
      where: { outletId, pramuniagaId, status: "COMPLETED", createdAt: { gte: from, lte: to } },
      _sum: { total: true },
    }),
    prisma.transaction.aggregate({
      where: { outletId, pramuniagaId, status: "COMPLETED", channel: { not: "CASH" }, createdAt: { gte: from, lte: to } },
      _sum: { total: true },
    }),
    prisma.transaction.aggregate({
      where: { outletId, pramuniagaId, status: "COMPLETED", createdAt: { gte: from, lte: to } },
      _sum: { discount: true },
    }),
    prisma.expenseRecord.aggregate({
      where: { outletId, submittedById: pramuniagaId, date: { gte: sessionDayStart, lt: sessionDayEnd } },
      _sum: { amount: true },
    }),
  ]);

  const omset = Number(totalAgg._sum.total ?? 0);
  const nonTunai = Number(nonTunaiAgg._sum.total ?? 0);
  const potongan = Number(discountAgg._sum.discount ?? 0);
  const expenses = Number(expenseAgg._sum.amount ?? 0);
  const summarySetoran = omset - nonTunai - potongan - expenses;

  return { omset, nonTunai, potongan, expenses, summarySetoran };
}
