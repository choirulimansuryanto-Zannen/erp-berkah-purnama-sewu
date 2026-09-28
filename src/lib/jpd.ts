import "server-only";
import { prisma } from "@/lib/prisma";

// JPD = "Jumlah Produk per Daging" — a yield KPI, not a raw material name.
// The 6 products below are exactly the Kebab/Shawarma items whose recipe
// consumes "daging ketul" (the two Freezer materials named below), matching
// the business's own POS catalog for this outlet's product line.
export const JPD_KETUL_PRODUCT_NAMES = [
  "Kebab Small",
  "Kebab Medium",
  "Kebab Super",
  "Kebab Jumbo",
  "Kebab Cheesy Black",
  "Shawarma",
];

// Exact FreezerMaterial names as seeded (see prisma/seed.ts) — casing kept
// as-is since it must match the stored row exactly.
export const JPD_DAGING_4KG_NAME = "Daging @4kg";
export const JPD_DAGING_2KG_NAME = "daging @2kg";

export type JpdSummary = {
  totalProdukKetul: number;
  pemakaianDaging: number;
  jpd: number;
};

/**
 * "Total produk ÷ (Daging 4kg + Daging 2kg × 0,5)" — a Kebab-meat yield KPI,
 * accumulated from the 1st of the month through `throughDate` (inclusive) so
 * it naturally resets each month with no separate reset mechanism. The two
 * Daging usage totals are computed by the caller (inventory/page.tsx already
 * has the live-vs-saved-history split needed for "Pakai" figures) — this
 * function only adds the product-sales half of the formula.
 */
export async function computeJpdSummary({
  outletId,
  throughDate,
  daging4kgUsed,
  daging2kgUsed,
}: {
  outletId: string;
  throughDate: Date; // UTC-midnight-normalized calendar date (see toDateOnlyKey)
  daging4kgUsed: number;
  daging2kgUsed: number;
}): Promise<JpdSummary> {
  const y = throughDate.getUTCFullYear();
  const m = throughDate.getUTCMonth();
  const d = throughDate.getUTCDate();
  // Local (WIB) day boundaries — Transaction.createdAt is a real timestamptz,
  // unlike the @db.Date-keyed FreezerStockRecord, so this must be actual
  // wall-clock midnight, not a UTC-midnight stand-in.
  const monthStart = new Date(y, m, 1);
  const exclusiveEnd = new Date(y, m, d + 1);

  // A direct `product.name IN (...)` sum would miss every sale of these
  // items bundled inside a Paket (Online/MBG/Kopdes/Pahlawan) — those sell
  // as the PAKET product's own TransactionItem row, not a Kebab/Shawarma
  // one. Decomposed via PackageComponent the same way computeStockPreview
  // does for Table 1's Terjual (sistem), so paket-embedded sales count too.
  const [targetProducts, items, packageComponents] = await Promise.all([
    prisma.product.findMany({ where: { name: { in: JPD_KETUL_PRODUCT_NAMES } }, select: { id: true } }),
    prisma.transactionItem.findMany({
      where: { transaction: { outletId, status: "COMPLETED", createdAt: { gte: monthStart, lt: exclusiveEnd } } },
      select: { productId: true, qty: true },
    }),
    prisma.packageComponent.findMany({ select: { packageProductId: true, componentProductId: true, qty: true } }),
  ]);

  const targetProductIds = new Set(targetProducts.map((p) => p.id));
  const componentsByPackageId = new Map<string, typeof packageComponents>();
  for (const c of packageComponents) {
    const list = componentsByPackageId.get(c.packageProductId) ?? [];
    list.push(c);
    componentsByPackageId.set(c.packageProductId, list);
  }

  let totalProdukKetul = 0;
  for (const item of items) {
    if (targetProductIds.has(item.productId)) totalProdukKetul += item.qty;
    const components = componentsByPackageId.get(item.productId);
    if (components) {
      for (const c of components) {
        if (c.componentProductId && targetProductIds.has(c.componentProductId)) {
          totalProdukKetul += item.qty * c.qty;
        }
      }
    }
  }
  const pemakaianDaging = daging4kgUsed + daging2kgUsed * 0.5;
  const jpd = pemakaianDaging > 0 ? totalProdukKetul / pemakaianDaging : 0;

  return { totalProdukKetul, pemakaianDaging, jpd };
}
