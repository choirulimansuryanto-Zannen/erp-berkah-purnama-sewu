import "server-only";
import { prisma } from "@/lib/prisma";
import { DAILY_REPORT_STOCK_ITEMS } from "@/lib/daily-report-stock-items";

/** The session's saved Ambil/Sisa draft, one entry per DAILY_REPORT_STOCK_ITEMS
 * position (0 for any item not yet touched) — shared between the Daily
 * Report page and Summary Setoran Outlet's mirrored stock table. */
export async function getStockDraft(
  outletId: string,
  pramuniagaId: string,
  date: Date,
): Promise<{ ambil: number; sisa: number }[]> {
  const rows = await prisma.dailyReportStockDraft.findMany({ where: { outletId, pramuniagaId, date } });
  const byIndex = new Map(rows.map((r) => [r.itemIndex, r]));
  return DAILY_REPORT_STOCK_ITEMS.map((_, i) => ({ ambil: byIndex.get(i)?.ambil ?? 0, sisa: byIndex.get(i)?.sisa ?? 0 }));
}
