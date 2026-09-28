import "server-only";
import { prisma } from "@/lib/prisma";

/** The session's saved qtyUsed draft for the Daging/Sayur/Bahan Baku (Saos &
 * Kemasan) tables, keyed by rawMaterialId — shared between Daily Report and
 * Summary Setoran Outlet, whichever the material tables happen to live on. */
export async function getMaterialDraft(outletId: string, pramuniagaId: string, date: Date): Promise<Record<string, number>> {
  const rows = await prisma.dailyReportMaterialDraft.findMany({ where: { outletId, pramuniagaId, date } });
  return Object.fromEntries(rows.map((r) => [r.rawMaterialId, Number(r.qtyUsed)]));
}
