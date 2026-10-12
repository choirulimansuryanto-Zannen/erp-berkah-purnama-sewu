import "server-only";
import { prisma } from "@/lib/prisma";
import { JPD_DAGING_4KG_NAME, JPD_DAGING_2KG_NAME } from "@/lib/jpd";

export const HARI_NAMES = ["Ahad", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function monthRange(year: number, month: number) {
  return { start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)) };
}
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// ═══════════════════════════════════════════════════════════════════════
// a. Omset Sheet — per-product daily quantity, Jan(day)-N grid, plus daging
// ketul usage tracking (Qty sold of tagged products -> Kg via each
// product's own gramsPerUnit).
//
// A paket Product (MBG/Kopdes/Trio/...) never gets its own column — a
// transaction line that sold one is translated into the products AND
// toppings it's actually made of (PackageComponent), the same
// decomposition src/lib/daily-report-stock.ts already uses for the
// kitchen's stock reconciliation, so e.g. "MBG 5" shows up here as Kebab
// Jumbo x2 + Kebab Cheesy Black x1 + Extra Chilimeat x2, never as "MBG 5".
// Toppings manually added to any cart line (package or not) count the same
// way, as their own columns after the products.
// ═══════════════════════════════════════════════════════════════════════
export type OmsetSheetItem = { key: string; id: string; name: string; kind: "product" | "topping"; usesDagingKetul: boolean };
export type OmsetSheetDay = {
  date: Date;
  totalOmset: number;
  qtyByKey: Record<string, number>;
  qtyAllProducts: number;
  qtyDagingKetulProducts: number;
  kgDagingKetul: number;
};

// The product/topping/package catalog never varies by outlet or month —
// fetching it fresh on every getOmsetSheet call is harmless for a single
// outlet's own report page, but getCompanyDailyIncentiveBreakdown calls this
// once per active outlet (63x), so `preloaded` lets it fetch this catalog
// ONCE up front and hand it to every outlet instead of 63 redundant copies
// of the exact same global tables.
type OmsetCatalog = Awaited<ReturnType<typeof loadOmsetCatalog>>;
export async function loadOmsetCatalog() {
  const [products, toppings, packageComponents] = await Promise.all([
    prisma.product.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.topping.findMany({ orderBy: { name: "asc" } }),
    prisma.packageComponent.findMany({ select: { packageProductId: true, componentProductId: true, componentToppingId: true, qty: true } }),
  ]);
  return { products, toppings, packageComponents };
}

const TX_ITEM_SELECT = {
  qty: true,
  productId: true,
  toppings: { select: { toppingId: true, qty: true } },
  transaction: { select: { outletId: true, createdAt: true, total: true } },
} as const;
type TxItemRow = Awaited<ReturnType<typeof prisma.transactionItem.findMany<{ select: typeof TX_ITEM_SELECT }>>>[number];

// `preloadedTxItems`, like `preloaded` above, exists only so a bulk caller
// (getCompanyDailyIncentiveBreakdown) can fetch every outlet's transaction
// items in ONE query instead of 63 separate per-outlet round trips, and hand
// each outlet its own pre-filtered slice. A single-outlet caller never
// passes this — it keeps fetching its own slice exactly as before.
export async function getOmsetSheet(
  outletId: string,
  year: number,
  month: number,
  preloaded?: OmsetCatalog,
  preloadedTxItems?: TxItemRow[],
) {
  const { start, end } = monthRange(year, month);
  const [txItems, catalog] = await Promise.all([
    preloadedTxItems
      ? Promise.resolve(preloadedTxItems)
      : prisma.transactionItem.findMany({
          where: { transaction: { outletId, status: "COMPLETED", createdAt: { gte: start, lte: end } } },
          select: TX_ITEM_SELECT,
        }),
    preloaded ? Promise.resolve(preloaded) : loadOmsetCatalog(),
  ]);
  const { products, toppings, packageComponents } = catalog;

  const productById = new Map(products.map((p) => [p.id, p]));
  const componentsByPackageId = new Map<string, typeof packageComponents>();
  for (const c of packageComponents) {
    const list = componentsByPackageId.get(c.packageProductId) ?? [];
    list.push(c);
    componentsByPackageId.set(c.packageProductId, list);
  }

  const nDays = daysInMonth(year, month);
  const days: OmsetSheetDay[] = Array.from({ length: nDays }, (_, i) => ({
    date: new Date(Date.UTC(year, month - 1, i + 1)),
    totalOmset: 0,
    qtyByKey: {},
    qtyAllProducts: 0,
    qtyDagingKetulProducts: 0,
    kgDagingKetul: 0,
  }));

  function addProductQty(day: OmsetSheetDay, productId: string, qty: number) {
    const p = productById.get(productId);
    if (!p) return;
    const key = `product:${productId}`;
    day.qtyByKey[key] = (day.qtyByKey[key] ?? 0) + qty;
    day.qtyAllProducts += qty;
    if (p.usesDagingKetul) {
      day.qtyDagingKetulProducts += qty;
      day.kgDagingKetul += (qty * Number(p.dagingKetulGramsPerUnit)) / 1000;
    }
  }
  function addToppingQty(day: OmsetSheetDay, toppingId: string, qty: number) {
    const key = `topping:${toppingId}`;
    day.qtyByKey[key] = (day.qtyByKey[key] ?? 0) + qty;
  }

  // Transaction total is shared across its items — attribute it once per
  // transaction (via a running per-day map keyed by its own timestamp)
  // rather than per item-row, so a multi-item order doesn't inflate the
  // day's Total Omset.
  const txByDay = new Map<number, Map<string, number>>();
  for (const item of txItems) {
    const dayIdx = item.transaction.createdAt.getUTCDate() - 1;
    const day = days[dayIdx];
    if (!day) continue;

    const product = productById.get(item.productId);
    if (product && product.category !== "ALACARTE") {
      // Paket — translate into its components instead of its own column.
      const components = componentsByPackageId.get(item.productId) ?? [];
      for (const c of components) {
        const consumed = item.qty * c.qty;
        if (c.componentProductId) addProductQty(day, c.componentProductId, consumed);
        else if (c.componentToppingId) addToppingQty(day, c.componentToppingId, consumed);
      }
    } else {
      addProductQty(day, item.productId, item.qty);
    }
    // Toppings manually added on top of the product/package itself.
    for (const t of item.toppings) addToppingQty(day, t.toppingId, t.qty);

    const txKey = item.transaction.createdAt.toISOString();
    const map = txByDay.get(dayIdx) ?? new Map<string, number>();
    map.set(txKey, Number(item.transaction.total));
    txByDay.set(dayIdx, map);
  }
  for (let i = 0; i < nDays; i++) {
    const map = txByDay.get(i);
    days[i].totalOmset = map ? [...map.values()].reduce((s, v) => s + v, 0) : 0;
  }

  // Column list: every product/topping that actually moved this month —
  // products first (menu order), then toppings (alphabetical).
  const soldKeys = new Set<string>();
  for (const day of days) for (const key of Object.keys(day.qtyByKey)) soldKeys.add(key);
  const items: OmsetSheetItem[] = [
    ...products
      .filter((p) => soldKeys.has(`product:${p.id}`))
      .map((p) => ({ key: `product:${p.id}`, id: p.id, name: p.name, kind: "product" as const, usesDagingKetul: p.usesDagingKetul })),
    ...toppings
      .filter((t) => soldKeys.has(`topping:${t.id}`))
      .map((t) => ({ key: `topping:${t.id}`, id: t.id, name: t.name, kind: "topping" as const, usesDagingKetul: false })),
  ];

  let cumulativeAll = 0;
  let cumulativeKetul = 0;
  let cumulativeKg = 0;
  const cumulative = days.map((d) => {
    cumulativeAll += d.qtyAllProducts;
    cumulativeKetul += d.qtyDagingKetulProducts;
    cumulativeKg += d.kgDagingKetul;
    return {
      qtyAllProducts: cumulativeAll,
      qtyDagingKetulProducts: cumulativeKetul,
      kgDagingKetul: cumulativeKg,
      pcsPer4Kg: cumulativeKg > 0 ? Math.round((cumulativeKetul / cumulativeKg) * 4) : 0,
    };
  });

  const totalOmset = days.reduce((s, d) => s + d.totalOmset, 0);
  return { items, days, cumulative, totalOmset };
}

// ═══════════════════════════════════════════════════════════════════════
// JPD Sheet — the "Jumlah Produk per Daging" yield KPI (see src/lib/jpd.ts)
// as a full daily rollup instead of a single as-of-today number: per day
// Total Omset, Qty terjual (semua produk & produk daging ketul), running
// Kumulatif produk-ketul + pemakaian daging (from the REAL FreezerMaterial
// "Pakai" records — Daging @4kg + daging @2kg×0.5 — not an estimate), and
// the two running averages (yield Pcs/4Kg, and Sales/hari).
// ═══════════════════════════════════════════════════════════════════════
export type JpdSheetDay = {
  date: Date;
  dayName: string;
  totalOmset: number;
  qtyAllProducts: number;
  qtyDagingKetulProducts: number;
  cumulativeDagingKetulProducts: number;
  cumulativeDagingKg: number;
  avgYieldPcsPer4Kg: number;
  avgSalesPerDay: number;
};

export async function getJpdSheet(outletId: string, year: number, month: number, omset: Awaited<ReturnType<typeof getOmsetSheet>>) {
  const { start, end } = monthRange(year, month);
  const materials = await prisma.freezerMaterial.findMany({ where: { name: { in: [JPD_DAGING_4KG_NAME, JPD_DAGING_2KG_NAME] } } });
  const daging4kg = materials.find((m) => m.name === JPD_DAGING_4KG_NAME);
  const daging2kg = materials.find((m) => m.name === JPD_DAGING_2KG_NAME);
  const materialIds = [daging4kg?.id, daging2kg?.id].filter((id): id is string => Boolean(id));

  const records = materialIds.length
    ? await prisma.freezerStockRecord.findMany({
        where: { outletId, freezerMaterialId: { in: materialIds }, date: { gte: start, lte: end } },
        select: { date: true, freezerMaterialId: true, used: true },
      })
    : [];

  const nDays = daysInMonth(year, month);
  const daging4kgUsedByDay = new Array(nDays).fill(0);
  const daging2kgUsedByDay = new Array(nDays).fill(0);
  for (const r of records) {
    const dayIdx = r.date.getUTCDate() - 1;
    if (dayIdx < 0 || dayIdx >= nDays) continue;
    if (r.freezerMaterialId === daging4kg?.id) daging4kgUsedByDay[dayIdx] += r.used;
    else if (r.freezerMaterialId === daging2kg?.id) daging2kgUsedByDay[dayIdx] += r.used;
  }

  let cumProdukKetul = 0;
  let cumBlocks = 0; // pemakaianDaging in 4kg-equivalent block units (same unit computeJpdSummary uses)
  let cumAllProducts = 0;
  const days: JpdSheetDay[] = omset.days.map((d, i) => {
    cumBlocks += daging4kgUsedByDay[i] + daging2kgUsedByDay[i] * 0.5;
    cumProdukKetul += d.qtyDagingKetulProducts;
    cumAllProducts += d.qtyAllProducts;
    return {
      date: d.date,
      dayName: HARI_NAMES[d.date.getUTCDay()],
      totalOmset: d.totalOmset,
      qtyAllProducts: d.qtyAllProducts,
      qtyDagingKetulProducts: d.qtyDagingKetulProducts,
      cumulativeDagingKetulProducts: cumProdukKetul,
      cumulativeDagingKg: cumBlocks * 4,
      avgYieldPcsPer4Kg: cumBlocks > 0 ? cumProdukKetul / cumBlocks : 0,
      avgSalesPerDay: cumAllProducts / (i + 1),
    };
  });

  const last = days.at(-1);
  return {
    days,
    totalOmset: omset.totalOmset,
    totalSemuaProduk: cumAllProducts,
    totalProdukKetul: cumProdukKetul,
    totalDagingKg: cumBlocks * 4,
    finalAvgYield: last?.avgYieldPcsPer4Kg ?? 0,
    finalAvgSales: last?.avgSalesPerDay ?? 0,
    hasFreezerData: materialIds.length === 2,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// b. Purchase Sheet — day × material matrix, exactly like the real
// spreadsheet: one row per day (Hari/Tanggal/Total Pembelian), one column
// per active OutletMaterial (36 items — Daging, Labanise, Roti, saos,
// packaging, alat pendukung — in the same category+sortOrder as the
// material master), each cell the day's purchased qty for that material.
// A bottom TOTAL row sums qty per column; CTRL PRICE cross-checks it
// (qty × unitPrice) against the same day-rows' own Total Pembelian sum —
// the same "two ways to the same number" integrity-check pattern used
// elsewhere in this file (Neraca Saldo Seimbang, etc).
//
// Driven purely by OutletPurchase rows tagged to a material — the old
// "Barang Masuk via Pramuniaga Inventory Record" (finished-Product
// receiving, not raw-material buying) doesn't map to any of these
// material columns, so it's no longer folded in here; getInventorySheet
// still reads OutletPurchase the same way for its own Masuk column.
// ═══════════════════════════════════════════════════════════════════════
export type PurchaseSheetMaterial = { id: string; code: string; name: string; unit: string; unitPrice: number };
export type PurchaseSheetDay = { date: Date; totalPembelian: number; qtyByMaterialId: Record<string, number> };

export async function getPurchaseSheet(outletId: string, year: number, month: number) {
  const { start, end } = monthRange(year, month);
  const [materials, purchases] = await Promise.all([
    prisma.outletMaterial.findMany({ where: { status: "ACTIVE" }, orderBy: [{ category: "asc" }, { sortOrder: "asc" } ] }),
    prisma.outletPurchase.findMany({
      where: { outletId, date: { gte: start, lte: end } },
      include: { createdBy: { select: { name: true } }, material: { select: { name: true } } },
      orderBy: { date: "asc" },
    }),
  ]);

  const nDays = daysInMonth(year, month);
  const days: PurchaseSheetDay[] = Array.from({ length: nDays }, (_, i) => ({
    date: new Date(Date.UTC(year, month - 1, i + 1)),
    totalPembelian: 0,
    qtyByMaterialId: {},
  }));

  for (const p of purchases) {
    const dayIdx = p.date.getUTCDate() - 1;
    const day = days[dayIdx];
    if (!day) continue;
    day.totalPembelian += Number(p.amount);
    if (p.materialId) day.qtyByMaterialId[p.materialId] = (day.qtyByMaterialId[p.materialId] ?? 0) + Number(p.qty);
  }

  const materialList: PurchaseSheetMaterial[] = materials.map((m) => ({ id: m.id, code: m.code, name: m.name, unit: m.unit, unitPrice: Number(m.unitPrice) }));
  const totalQtyByMaterialId: Record<string, number> = {};
  for (const m of materialList) totalQtyByMaterialId[m.id] = days.reduce((s, d) => s + (d.qtyByMaterialId[m.id] ?? 0), 0);
  const ctrlPriceByMaterialId: Record<string, number> = {};
  for (const m of materialList) ctrlPriceByMaterialId[m.id] = totalQtyByMaterialId[m.id] * m.unitPrice;

  const total = days.reduce((s, d) => s + d.totalPembelian, 0);
  const totalCtrlPrice = materialList.reduce((s, m) => s + ctrlPriceByMaterialId[m.id], 0);

  // Kept for the entry log below the matrix (edit/delete individual rows).
  const entries = purchases.map((p) => ({
    id: p.id,
    date: p.date,
    description: p.material ? `${p.description} (${p.material.name})` : p.description,
    category: p.category,
    qty: Number(p.qty),
    unit: p.unit,
    amount: Number(p.amount),
    createdBy: p.createdBy.name,
  }));

  return { materials: materialList, days, totalQtyByMaterialId, ctrlPriceByMaterialId, total, totalCtrlPrice, entries };
}

// ═══════════════════════════════════════════════════════════════════════
// c. Adjustment Sheet — OutletAdjustment entries (input-driven, Barang
// Rusak/Reject/Selisih/Keluar). Keluar (mutasi keluar — stock deliberately
// moved out to another outlet/gudang) is tracked alongside the other
// three but is NOT a loss, so it's excluded from the loss `total`.
// ═══════════════════════════════════════════════════════════════════════
export async function getAdjustmentSheet(outletId: string, year: number, month: number) {
  const { start, end } = monthRange(year, month);
  const rows = await prisma.outletAdjustment.findMany({
    where: { outletId, date: { gte: start, lte: end } },
    include: { material: { select: { name: true } }, createdBy: { select: { name: true } } },
    orderBy: { date: "asc" },
  });
  const byType = { RUSAK: 0, REJECT: 0, SELISIH: 0, KELUAR: 0 } as Record<string, number>;
  const qtyByType = { RUSAK: 0, REJECT: 0, SELISIH: 0, KELUAR: 0 } as Record<string, number>;
  for (const r of rows) {
    byType[r.type] += Number(r.amount);
    qtyByType[r.type] += Number(r.qty);
  }
  const total = byType.RUSAK + byType.REJECT + byType.SELISIH;
  return { rows, byType, qtyByType, total, totalKeluar: byType.KELUAR };
}

// ═══════════════════════════════════════════════════════════════════════
// g. Inventory Sheet — "Data Stock Available": every OutletMaterial's
// Awal/Masuk/Rusak/Reject/Selisih/Keluar/Saldo, qty + nominal, grouped by
// category. Awal/Masuk/Rusak/Reject/Selisih/Keluar all have a real
// source; Pakai is the residual (Awal + Masuk - Rusak - Reject - Selisih
// - Keluar - Akhir) — the same "back out the plug" approach FA Company's
// own HPP report uses, since there's no per-product recipe/BOM tracked to
// compute it directly. Keluar (mutasi keluar) is a deliberate transfer
// out to another outlet/gudang, not a loss like Rusak/Reject/Selisih.
// ═══════════════════════════════════════════════════════════════════════
export type MaterialStockRow = {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  unitPrice: number;
  awalQty: number;
  masukQty: number;
  rusakQty: number;
  rejectQty: number;
  selisihQty: number;
  keluarQty: number;
  pakaiQty: number;
  akhirQty: number;
  akhirRecorded: boolean;
};

export async function getInventorySheet(outletId: string, year: number, month: number) {
  const { start, end } = monthRange(year, month);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const [materials, purchasesMonth, adjustmentsMonth, akhirThis, akhirPrev] = await Promise.all([
    prisma.outletMaterial.findMany({ where: { status: "ACTIVE" }, orderBy: [{ category: "asc" }, { sortOrder: "asc" }] }),
    prisma.outletPurchase.findMany({ where: { outletId, date: { gte: start, lte: end }, materialId: { not: null } } }),
    prisma.outletAdjustment.findMany({ where: { outletId, date: { gte: start, lte: end }, materialId: { not: null } } }),
    prisma.outletMaterialClosingBalance.findMany({ where: { outletId, year, month } }),
    prisma.outletMaterialClosingBalance.findMany({ where: { outletId, year: prevYear, month: prevMonth } }),
  ]);

  const masukByMaterial = new Map<string, number>();
  for (const p of purchasesMonth) masukByMaterial.set(p.materialId!, (masukByMaterial.get(p.materialId!) ?? 0) + Number(p.qty));
  const rusakByMaterial = new Map<string, number>();
  const rejectByMaterial = new Map<string, number>();
  const selisihByMaterial = new Map<string, number>();
  const keluarByMaterial = new Map<string, number>();
  const byTypeMap: Record<string, Map<string, number>> = { RUSAK: rusakByMaterial, REJECT: rejectByMaterial, SELISIH: selisihByMaterial, KELUAR: keluarByMaterial };
  for (const a of adjustmentsMonth) {
    const map = byTypeMap[a.type];
    if (!map) continue;
    map.set(a.materialId!, (map.get(a.materialId!) ?? 0) + Number(a.qty));
  }
  const akhirByMaterial = new Map(akhirThis.map((r) => [r.materialId, Number(r.qty)]));
  const awalByMaterial = new Map(akhirPrev.map((r) => [r.materialId, Number(r.qty)]));

  const rows: MaterialStockRow[] = materials.map((m) => {
    const awalQty = awalByMaterial.get(m.id) ?? 0;
    const masukQty = masukByMaterial.get(m.id) ?? 0;
    const rusakQty = rusakByMaterial.get(m.id) ?? 0;
    const rejectQty = rejectByMaterial.get(m.id) ?? 0;
    const selisihQty = selisihByMaterial.get(m.id) ?? 0;
    const keluarQty = keluarByMaterial.get(m.id) ?? 0;
    const akhirRecorded = akhirByMaterial.has(m.id);
    const akhirQty = akhirByMaterial.get(m.id) ?? awalQty + masukQty - rusakQty - rejectQty - selisihQty - keluarQty;
    const pakaiQty = awalQty + masukQty - rusakQty - rejectQty - selisihQty - keluarQty - akhirQty;
    return {
      id: m.id,
      code: m.code,
      name: m.name,
      category: m.category,
      unit: m.unit,
      unitPrice: Number(m.unitPrice),
      awalQty,
      masukQty,
      rusakQty,
      rejectQty,
      selisihQty,
      keluarQty,
      pakaiQty,
      akhirQty,
      akhirRecorded,
    };
  });

  const totalAkhirNominal = rows.reduce((s, r) => s + r.akhirQty * r.unitPrice, 0);
  const byCategory = new Map<string, number>();
  for (const r of rows) byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + r.akhirQty * r.unitPrice);

  return { rows, totalAkhirNominal, byCategory };
}

// ═══════════════════════════════════════════════════════════════════════
// d./h. Report Sheet — A. Penjualan / B. Pembelian (HPP) / C. Biaya
// (Overhead Langsung/Tidak Langsung), computed directly from this month's
// Jurnal Sheet ledger entries (OutletLedgerEntry), grouped by account — the
// business's own "jurnal yg di input", not a Transaction/ExpenseRecord
// rollup. Persediaan Awal/Akhir are the only two lines that aren't ledger
// accounts — they come from the Inventory Sheet's own stock data
// (OutletMaterialClosingBalance, BAHAN_UTAMA + BAHAN_BAKU_TAMBAHAN).
//
// Each account's ledger net (sum of D minus sum of C, in Rupiah) is
// signed so that summing a section's lines directly gives the correct
// section total — e.g. a "Potongan Penjualan" line (habitually entered as
// C) nets negative on its own, so Total Penjualan = sum(A's raw nets)
// already subtracts it correctly. B/C sections flip that sign (C-D
// instead of D-C) so a cost account posted as C displays as a positive
// cost, matching the source spreadsheet's "always show the magnitude"
// style — the UI applies Math.abs() for display and uses the signed
// amount only for totals.
// ═══════════════════════════════════════════════════════════════════════
const SALES_ACCOUNT_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 41, 42, 11, 12, 13];
const PEMBELIAN_ACCOUNT_NUMBERS = [14, 15, 16, 17, 18, 19, 20];
const OVERHEAD_LANGSUNG_NUMBERS = [21, 22, 23, 24, 25, 26];
const OVERHEAD_TIDAK_LANGSUNG_NUMBERS = [27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40];

export type ReportSheetLine = { number: number; label: string; amount: number };

export async function getReportSheet(outletId: string, year: number, month: number, inventory: Awaited<ReturnType<typeof getInventorySheet>>) {
  const { start, end } = monthRange(year, month);
  const [entries, accounts] = await Promise.all([
    prisma.outletLedgerEntry.findMany({
      where: { outletId, date: { gte: start, lte: end } },
      select: { side: true, amount: true, account: { select: { number: true } } },
    }),
    prisma.outletLedgerAccount.findMany(),
  ]);

  const accountByNumber = new Map(accounts.map((a) => [a.number, a]));
  const netByNumber = new Map<number, number>();
  for (const e of entries) {
    const amt = Number(e.amount);
    const delta = e.side === "D" ? amt : -amt;
    netByNumber.set(e.account.number, (netByNumber.get(e.account.number) ?? 0) + delta);
  }
  function line(number: number, sign: 1 | -1): ReportSheetLine {
    const acc = accountByNumber.get(number);
    const net = netByNumber.get(number) ?? 0;
    return { number, label: acc?.label ?? `Akun ${number}`, amount: sign * net };
  }

  const penjualanRows = SALES_ACCOUNT_NUMBERS.map((n) => line(n, 1));
  const totalPenjualan = penjualanRows.reduce((s, r) => s + r.amount, 0);

  const bahanBakuMaterials = inventory.rows.filter((r) => r.category === "BAHAN_UTAMA" || r.category === "BAHAN_BAKU_TAMBAHAN");
  const persediaanAwal = bahanBakuMaterials.reduce((s, r) => s + r.awalQty * r.unitPrice, 0);
  const persediaanAkhir = bahanBakuMaterials.reduce((s, r) => s + r.akhirQty * r.unitPrice, 0);

  const pembelianRows: ReportSheetLine[] = [
    { number: 0, label: "Persediaan Barang Awal", amount: persediaanAwal },
    ...PEMBELIAN_ACCOUNT_NUMBERS.map((n) => line(n, -1)),
    { number: 0, label: "Stock Bahan Baku (Persediaan Akhir)", amount: -persediaanAkhir },
  ];
  const totalHpp = pembelianRows.reduce((s, r) => s + r.amount, 0);
  const labaKotor = totalPenjualan - totalHpp;

  const overheadLangsungRows = OVERHEAD_LANGSUNG_NUMBERS.map((n) => line(n, -1));
  const overheadTidakLangsungRows = OVERHEAD_TIDAK_LANGSUNG_NUMBERS.map((n) => line(n, -1));
  const totalOverheadLangsung = overheadLangsungRows.reduce((s, r) => s + r.amount, 0);
  const totalOverheadTidakLangsung = overheadTidakLangsungRows.reduce((s, r) => s + r.amount, 0);
  const totalBiaya = totalOverheadLangsung + totalOverheadTidakLangsung;
  const labaBersih = labaKotor - totalBiaya;

  return {
    penjualanRows,
    totalPenjualan,
    pembelianRows,
    totalHpp,
    labaKotor,
    overheadLangsungRows,
    totalOverheadLangsung,
    overheadTidakLangsungRows,
    totalOverheadTidakLangsung,
    totalBiaya,
    labaBersih,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// d. Jurnal Sheet — LEDGER format: a direct digitization of the business's
// own daily bookkeeping habit (Tanggal / No. Akun / Keterangan / D-C /
// Nilai), posted against the fixed OutletLedgerAccount chart of accounts.
// Accum. is a running D-adds/C-subtracts balance that resets to 0 at the
// start of each month; Total/Day is that day's ending Accum.
// ═══════════════════════════════════════════════════════════════════════
export type LedgerSheetRow = {
  id: string;
  date: Date;
  accountNumber: number;
  accountLabel: string;
  description: string;
  side: "D" | "C";
  amount: number;
  accum: number;
};
export type LedgerSheetDayGroup = {
  date: Date;
  rows: LedgerSheetRow[];
  totalDay: number;
};

export async function getAkunLedgerSheet(outletId: string, year: number, month: number) {
  const { start, end } = monthRange(year, month);
  const entries = await prisma.outletLedgerEntry.findMany({
    where: { outletId, date: { gte: start, lte: end } },
    include: { account: true },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });

  const dayGroups: LedgerSheetDayGroup[] = [];
  const dayGroupByKey = new Map<string, LedgerSheetDayGroup>();
  let runningAccum = 0;
  let totalDebit = 0;
  let totalCredit = 0;
  for (const e of entries) {
    const amount = Number(e.amount);
    runningAccum += e.side === "D" ? amount : -amount;
    if (e.side === "D") totalDebit += amount;
    else totalCredit += amount;

    const dayKey = e.date.toISOString().slice(0, 10);
    let group = dayGroupByKey.get(dayKey);
    if (!group) {
      group = { date: e.date, rows: [], totalDay: 0 };
      dayGroupByKey.set(dayKey, group);
      dayGroups.push(group);
    }
    group.rows.push({
      id: e.id,
      date: e.date,
      accountNumber: e.account.number,
      accountLabel: e.account.label,
      description: e.description,
      side: e.side,
      amount,
      accum: runningAccum,
    });
    group.totalDay = runningAccum;
  }

  return { dayGroups, totalDebit, totalCredit, endingBalance: runningAccum };
}

// ═══════════════════════════════════════════════════════════════════════
// Shared day-by-day roster — every day of the month's Omset, who was
// present, and (if any) which IncentiveBracket matched — computed ONCE
// and consumed by both the Absen Sheet and the Insentive Sheet below, so
// splitting them into two displays doesn't mean two separate queries and
// two chances for the numbers to drift apart.
// ═══════════════════════════════════════════════════════════════════════
export type RosterDay = {
  date: Date;
  omset: number;
  qtyAllProducts: number;
  present: { userId: string; name: string; shift: string; rosterKey?: string }[];
  bracket: { label: string; rangeMin: number; rangeMax: number | null; rateSinglePic: number; rateMultiPic: number } | null;
  rateUsed: number;
  // The actual payout — 0 on every day the month's gate (omset AND JPD)
  // didn't clear. totalInsentifHariRaw is what the bracket math alone
  // would have produced, kept so a report can show "Rp X calculated, Rp 0
  // paid" rather than losing the pre-gate figure entirely.
  totalInsentifHari: number;
  totalInsentifHariRaw: number;
};

// Same reasoning as OmsetCatalog above — the active bracket table is global,
// not per-outlet, so getCompanyDailyIncentiveBreakdown can fetch it once and
// hand it to every outlet instead of re-querying it 63 times.
type BracketList = Awaited<ReturnType<typeof prisma.incentiveBracket.findMany>>;
const ATTENDANCE_INCLUDE = { user: { select: { id: true, name: true } }, pramuniagaRoster: { select: { name: true } } } as const;
type AttendanceRow = Awaited<ReturnType<typeof prisma.attendanceRecord.findMany<{ include: typeof ATTENDANCE_INCLUDE }>>>[number];

// `preloadedAttendance`, same reasoning as getOmsetSheet's `preloadedTxItems`
// — lets a bulk caller fetch every outlet's attendance in ONE query and hand
// each outlet its own slice, instead of 63 separate round trips. A
// single-outlet caller never passes this.
export async function getDailyRoster(
  outletId: string,
  year: number,
  month: number,
  omset: Awaited<ReturnType<typeof getOmsetSheet>>,
  preloadedBrackets?: BracketList,
  preloadedAttendance?: AttendanceRow[],
  // JPD (Jumlah Produk per Daging — the yield KPI, same figure the JPD
  // Sheet shows as "Rata-rata Penggunaan Daging/Ketul") for this
  // outlet/month. Omitted by callers that don't need the JPD gate
  // (Fullshift's own achievement rule is independent of this) — in that
  // case the JPD condition is treated as passed, same "no data = don't
  // block" convention already used for the omset target above.
  jpdAvgYield?: number,
) {
  const { start, end } = monthRange(year, month);
  const [attendance, brackets, monthlyTargetRow] = await Promise.all([
    preloadedAttendance
      ? Promise.resolve(preloadedAttendance)
      : prisma.attendanceRecord.findMany({
          where: { outletId, date: { gte: start, lte: end } },
          include: ATTENDANCE_INCLUDE,
        }),
    preloadedBrackets ? Promise.resolve(preloadedBrackets) : prisma.incentiveBracket.findMany({ where: { status: "ACTIVE" }, orderBy: { sortOrder: "asc" } }),
    prisma.outletMonthlyTarget.findUnique({ where: { outletId_year_month: { outletId, year, month } } }),
  ]);

  const presentByDay = new Map<string, { userId: string; name: string; shift: string; rosterKey?: string }[]>();
  for (const a of attendance) {
    if (a.status !== "PRESENT" && a.status !== "LATE") continue;
    const key = a.date.toISOString().slice(0, 10);
    const list = presentByDay.get(key) ?? [];
    // Same roster-name resolution used everywhere else a login may be
    // shared by several checked-in roster members (Kasbon, Rekap Setoran).
    const name = a.pramuniagaRoster?.name ?? a.user.name;
    // Dedup by the actual PERSON (roster member if one was recorded, else
    // the login itself) — NOT by userId alone. A shared login checked in as
    // two different roster members on the same day (exactly the "fullshift
    // + shift lainnya" case this whole incentive-weighting rule is about)
    // would otherwise silently collapse to just one of them here, under-
    // counting both the crew size for rate selection and the per-person
    // incentive split below.
    const identityKey = a.pramuniagaRosterId ?? a.userId;
    if (!list.some((p) => (p.rosterKey ?? p.userId) === identityKey)) list.push({ userId: a.userId, name, shift: a.shift, rosterKey: a.pramuniagaRosterId ?? undefined });
    presentByDay.set(key, list);
  }
  function bracketFor(dayOmset: number) {
    return brackets.find((b) => dayOmset >= Number(b.rangeMin) && (b.rangeMax === null || dayOmset <= Number(b.rangeMax)));
  }

  const days: RosterDay[] = omset.days.map((d) => {
    const dateKey = d.date.toISOString().slice(0, 10);
    const present = presentByDay.get(dateKey) ?? [];
    const bracketRow = d.totalOmset > 0 ? bracketFor(d.totalOmset) : undefined;
    const rateUsed = bracketRow ? (present.length > 1 ? Number(bracketRow.rateMultiPic) : Number(bracketRow.rateSinglePic)) : 0;
    const totalInsentifHariRaw = bracketRow && present.length > 0 ? (d.totalOmset * rateUsed) / 100 : 0;
    return {
      date: d.date,
      omset: d.totalOmset,
      qtyAllProducts: d.qtyAllProducts,
      present,
      bracket: bracketRow
        ? {
            label: bracketRow.label,
            rangeMin: Number(bracketRow.rangeMin),
            rangeMax: bracketRow.rangeMax === null ? null : Number(bracketRow.rangeMax),
            rateSinglePic: Number(bracketRow.rateSinglePic),
            rateMultiPic: Number(bracketRow.rateMultiPic),
          }
        : null,
      rateUsed,
      totalInsentifHari: totalInsentifHariRaw, // zeroed below if the gate doesn't clear
      totalInsentifHariRaw,
    };
  });

  // Plafond gate: insentif is only actually paid out once the outlet clears
  // BOTH conditions the business set (confirmed 2026-10-12): (1) 80% of its
  // monthly Omset target — insentifMonthlyTarget already IS that 80%
  // threshold (see OutletMonthlyTarget: it's derived as monthlyTarget × 0.8
  // when targets are set), so this is a direct comparison, not a second
  // 0.8 multiply here — and (2) JPD >= 75. Bracket/rate matching stays
  // visible on each day, and totalInsentifHariRaw keeps what the bracket
  // math alone would have produced, but totalInsentifHari (the actual
  // payout) is zeroed out whenever either gate doesn't clear. No target
  // configured for the outlet/month defaults that condition to "passed" so
  // outlets without a target (or without JPD data) set yet aren't silently
  // zeroed on a condition that was never meant to apply to them.
  const monthlyAchieved = days.reduce((s, d) => s + d.omset, 0);
  const monthlyTarget = monthlyTargetRow ? Number(monthlyTargetRow.insentifMonthlyTarget) : 0;
  const omsetGatePassed = monthlyTarget > 0 ? monthlyAchieved >= monthlyTarget : true;
  const jpdGatePassed = jpdAvgYield === undefined ? true : jpdAvgYield >= 75;
  const gatePassed = omsetGatePassed && jpdGatePassed;
  const achievementPct = monthlyTarget > 0 ? (monthlyAchieved / monthlyTarget) * 100 : null;
  if (!gatePassed) {
    for (const day of days) day.totalInsentifHari = 0;
  }

  return {
    days,
    bracketsConfigured: brackets.length > 0,
    brackets,
    monthlyTarget,
    monthlyAchieved,
    gatePassed,
    omsetGatePassed,
    jpdGatePassed,
    jpdAvgYield: jpdAvgYield ?? null,
    achievementPct,
  };
}

// A day's insentif pot isn't split evenly per head — it's split per "slot",
// where a FULLSHIFT person counts as 2 slots and a SHIFT_1/SHIFT_2 person
// counts as 1 — e.g. one fullshift + one half-shift on the same day splits
// the pot 3 ways (fullshift gets 2 of those 3 shares). The one exception:
// a LONE fullshift pramuniaga (nobody else on duty that day) still counts
// as a single slot — the 2x weighting only kicks in once there's someone
// else to split against, never on a solo day regardless of that person's
// own shift type.
function incentiveSlotWeight(present: RosterDay["present"], person: RosterDay["present"][number]): number {
  if (present.length <= 1) return 1;
  return person.shift === "FULLSHIFT" ? 2 : 1;
}
function incentiveTotalSlots(present: RosterDay["present"]): number {
  if (present.length <= 1) return present.length;
  return present.reduce((sum, p) => sum + incentiveSlotWeight(present, p), 0);
}
/** One day's incentive pot, per slot (see incentiveSlotWeight) — multiply
 * by a specific person's own weight to get what THEY earn that day. */
function incentiveValuePerSlot(day: RosterDay): number {
  const slots = incentiveTotalSlots(day.present);
  return slots > 0 ? day.totalInsentifHari / slots : 0;
}
/** Same split, but against the RAW (pre-gate) pot — what this person would
 * have earned that day if the month's gate had cleared. Used by Laporan
 * Rekapitulasi Insentive's "Tidak Diberikan" view (CALCULATED column). */
function incentiveValuePerSlotRaw(day: RosterDay): number {
  const slots = incentiveTotalSlots(day.present);
  return slots > 0 ? day.totalInsentifHariRaw / slots : 0;
}

// ═══════════════════════════════════════════════════════════════════════
// e. Absen Sheet — one row per pramuniaga: a day-by-day attendance
// calendar (1..N, highlighting Ahad/Sunday), Qty Sales & Insentive Value
// (each day's total split evenly across whoever was present that day —
// same split the Insentive Sheet uses), Total Standby (days present),
// Masa non Insentive (days present but that day earned no incentive —
// zero Omset or no bracket matched), and Total Absen (days in the
// month). Labor Cost has no wage-rate/HR data model to compute from, so
// it's manually entered (OutletPayroll). Salary is prorated from a
// manually-entered base ("Gaji Pokok", assuming a standard 27-day working
// month): Total Salary = (Hari Kerja / 27) × Gaji Pokok.
// ═══════════════════════════════════════════════════════════════════════
const STANDARD_WORKING_DAYS = 27;

export type AbsenSheetRow = {
  userId: string;
  // Stable per-PERSON identity for grouping/React keys — distinct from
  // userId, which is the shared login and can genuinely be the same value
  // for two different roster members (see byEmployee below). Falls back to
  // userId when the day has no roster member recorded.
  rosterKey: string;
  name: string;
  attendance: boolean[]; // length = days in month
  qtySales: number;
  insentiveValue: number;
  // What insentiveValue would be if the month's gate (JPD>=75 AND omset
  // >=80% target) hadn't zeroed it — equal to insentiveValue whenever the
  // gate passed. Used by Laporan Rekapitulasi Insentive's "Tidak Diberikan"
  // view to show what was calculated vs. what was actually paid (0).
  insentiveValueRaw: number;
  totalStandby: number;
  totalNonInsentif: number;
  laborCost: number;
  baseSalary: number; // "Gaji Pokok" — the manually-entered full-27-day rate
  totalSalary: number; // computed: (totalStandby / 27) × baseSalary
  payrollRecorded: boolean;
};

export async function getAbsenSheet(
  outletId: string,
  year: number,
  month: number,
  omset: Awaited<ReturnType<typeof getOmsetSheet>>,
  jpdAvgYield?: number,
) {
  const [roster, payrolls] = await Promise.all([
    getDailyRoster(outletId, year, month, omset, undefined, undefined, jpdAvgYield),
    prisma.outletPayroll.findMany({ where: { outletId, year, month } }),
  ]);
  const nDays = daysInMonth(year, month);
  const payrollByUserId = new Map(payrolls.map((p) => [p.userId, p]));

  // Keyed by the PERSON (rosterKey ?? userId), never by userId alone — a
  // login can be shared by several roster members on the same crew-of-2
  // day (the whole reason the fullshift-weight split exists), and keying
  // this map by userId silently merged their attendance/insentif into one
  // row under whichever name was inserted first. Mirrors the identity key
  // getDailyRoster's own dedup and getCompanyDailyIncentiveBreakdown both use.
  const byEmployee = new Map<string, Omit<AbsenSheetRow, "totalSalary">>();
  for (let i = 0; i < roster.days.length; i++) {
    const day = roster.days[i];
    const perPersonQty = day.present.length > 0 ? day.qtyAllProducts / day.present.length : 0;
    const insentifPerSlot = incentiveValuePerSlot(day);
    const insentifPerSlotRaw = incentiveValuePerSlotRaw(day);
    for (const p of day.present) {
      const identityKey = p.rosterKey ?? p.userId;
      const payroll = payrollByUserId.get(p.userId);
      const row = byEmployee.get(identityKey) ?? {
        userId: p.userId,
        rosterKey: identityKey,
        name: p.name,
        attendance: new Array(nDays).fill(false),
        qtySales: 0,
        insentiveValue: 0,
        insentiveValueRaw: 0,
        totalStandby: 0,
        totalNonInsentif: 0,
        laborCost: Number(payroll?.laborCost ?? 0),
        baseSalary: Number(payroll?.salary ?? 0),
        payrollRecorded: Boolean(payroll),
      };
      row.attendance[i] = true;
      row.qtySales += perPersonQty;
      const weight = incentiveSlotWeight(day.present, p);
      row.insentiveValue += insentifPerSlot * weight;
      row.insentiveValueRaw += insentifPerSlotRaw * weight;
      row.totalStandby += 1;
      if (!day.bracket || day.omset <= 0) row.totalNonInsentif += 1;
      byEmployee.set(identityKey, row);
    }
  }

  const rows: AbsenSheetRow[] = [...byEmployee.values()]
    .map((r) => ({ ...r, totalSalary: Math.round((r.totalStandby / STANDARD_WORKING_DAYS) * r.baseSalary) }))
    .sort((a, b) => b.qtySales - a.qtySales);
  const totalQtySales = rows.reduce((s, r) => s + r.qtySales, 0);
  const totalInsentiveValue = rows.reduce((s, r) => s + r.insentiveValue, 0);
  const totalStandbyAll = rows.reduce((s, r) => s + r.totalStandby, 0);
  const totalOmsetBulan = roster.days.reduce((s, d) => s + d.omset, 0);

  return {
    rows,
    nDays,
    totalAbsenPerRow: nDays,
    totalQtySales,
    totalInsentiveValue,
    totalStandbyAll,
    totalOmsetBulan,
    // AVG Sales/AVG Beef — a productivity KPI: how much moved per staff-day
    // worked, not per calendar day. Beef needs the JPD Sheet's real usage
    // figure, so it's filled in by the caller (see getInsentiveSheet).
    avgSalesPerAbsen: totalStandbyAll > 0 ? totalQtySales / totalStandbyAll : 0,
    bracketsConfigured: roster.bracketsConfigured,
    // Exposed so getInsentiveSheet can reuse this same roster computation
    // instead of re-querying attendance/brackets from scratch.
    rosterDays: roster.days,
    brackets: roster.brackets,
    monthlyTarget: roster.monthlyTarget,
    monthlyAchieved: roster.monthlyAchieved,
    gatePassed: roster.gatePassed,
    omsetGatePassed: roster.omsetGatePassed,
    jpdGatePassed: roster.jpdGatePassed,
    jpdAvgYield: roster.jpdAvgYield,
    achievementPct: roster.achievementPct,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// f. Insentive Sheet — the day-by-day bracket calculation table (which
// range matched, at what rate, the day's Achieve Omset & Insentive), plus
// the same per-employee Absen+Insentive figures shown side by side, plus
// the outlet's other incentive lines this month (Royalti, Insentive
// Officer/Head Sales — reusing the already-computed company-wide
// IncentiveCalculation rows, prorated by this outlet's Omset share for
// the two company-scoped ones, same convention the Laporan Insentif page
// itself uses).
//
// NOT built here: the source spreadsheet's separate qty-based "KALKULASI
// Insentive Controller" bracket table — a different scheme for a
// "Controller" role this system has no equivalent of yet. Flagged rather
// than guessed at.
// ═══════════════════════════════════════════════════════════════════════
export async function getInsentiveSheet(
  outletId: string,
  year: number,
  month: number,
  jpd: Awaited<ReturnType<typeof getJpdSheet>>,
  report: Awaited<ReturnType<typeof getReportSheet>>,
  absen: Awaited<ReturnType<typeof getAbsenSheet>>,
) {
  const [incentiveCalcs, outletRow, companyOmset] = await Promise.all([
    prisma.incentiveCalculation.findMany({ where: { year, month, OR: [{ outletId }, { scope: "COMPANY" }] } }),
    prisma.outlet.findUnique({ where: { id: outletId }, select: { name: true } }),
    getOutletMonthlyOmsetForCompanyShare(year, month),
  ]);

  const royaltyCalc = incentiveCalcs.find((c) => c.outletId === outletId && c.type === "ROYALTY");
  const officerCalc = incentiveCalcs.find((c) => c.scope === "COMPANY" && c.type === "OFFICER_SALES");
  const headCalc = incentiveCalcs.find((c) => c.scope === "COMPANY" && c.type === "HEAD_SALES");
  const outletShare = companyOmset > 0 ? absen.totalOmsetBulan / companyOmset : 0;
  const insentiveOfficer = officerCalc ? Number(officerCalc.amount) * outletShare : 0;
  const insentiveHead = headCalc ? Number(headCalc.amount) * outletShare : 0;
  const royalti = royaltyCalc ? Number(royaltyCalc.amount) : 0;

  const totalKgDaging = jpd.totalDagingKg;
  const avgBeefPerAbsen = absen.totalStandbyAll > 0 ? totalKgDaging / absen.totalStandbyAll : 0;

  return {
    outletName: outletRow?.name ?? "",
    days: absen.rosterDays,
    brackets: absen.brackets,
    bracketsConfigured: absen.bracketsConfigured,
    absenRows: absen.rows,
    totalInsentifHari: absen.rosterDays.reduce((s, d) => s + d.totalInsentifHari, 0),
    totalInsentifHariRaw: absen.rosterDays.reduce((s, d) => s + d.totalInsentifHariRaw, 0),
    openingDay: absen.nDays,
    royalti,
    insentiveOfficer,
    insentiveHead,
    omsetBersih: report.totalPenjualan,
    avgSales: absen.avgSalesPerAbsen,
    avgBeef: avgBeefPerAbsen,
    monthlyTarget: absen.monthlyTarget,
    monthlyAchieved: absen.monthlyAchieved,
    gatePassed: absen.gatePassed,
    omsetGatePassed: absen.omsetGatePassed,
    jpdGatePassed: absen.jpdGatePassed,
    jpdAvgYield: absen.jpdAvgYield,
    achievementPct: absen.achievementPct,
  };
}

async function getOutletMonthlyOmsetForCompanyShare(year: number, month: number): Promise<number> {
  const { start, end } = monthRange(year, month);
  const agg = await prisma.dailyReport.aggregate({ where: { status: "APPROVED", date: { gte: start, lte: end } }, _sum: { omset: true } });
  return Number(agg._sum.omset ?? 0);
}

// ═══════════════════════════════════════════════════════════════════════
// Company-wide daily incentive breakdown — the same bracket/roster math
// the Insentive Sheet uses for one outlet, run across every active outlet
// and flattened to one row per (day, outlet, pramuniaga present that day)
// — for Laporan Insentif's "perincian harian seluruh pramuniaga" table.
// Reuses getOmsetSheet + getDailyRoster per outlet (not DailyReport.omset)
// specifically so this never disagrees with what each outlet's own
// Insentive Sheet shows for the same day.
// ═══════════════════════════════════════════════════════════════════════
export type DailyIncentiveRow = {
  date: Date;
  outletName: string;
  omset: number;
  ratePercent: number;
  plafonLabel: string;
  pramuniagaName: string;
  pramuniagaKey: string; // the real person — group/sum the summary table by this, never by display name
  shift: string;
  qtyPramuniaga: number; // the "slot" weight this person counts as that day — 2 for a fullshift sharing the day with someone else, 1 otherwise
  insentifPerPramu: number;
};

export async function getCompanyDailyIncentiveBreakdown(year: number, month: number): Promise<DailyIncentiveRow[]> {
  const { start, end } = monthRange(year, month);

  // Everything below is fetched ONCE for every active outlet instead of once
  // PER outlet (63 outlets × 2 genuinely outlet-scoped queries used to mean
  // 126 separate round trips here alone) — this function is the only caller
  // that needs all outlets at once, so the batching lives here rather than
  // in getOmsetSheet/getDailyRoster themselves, which every single-outlet
  // caller (the per-outlet report page, etc.) still calls exactly as before.
  const [outlets, catalog, brackets, allTxItems, allAttendance] = await Promise.all([
    prisma.outlet.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true } }),
    loadOmsetCatalog(),
    prisma.incentiveBracket.findMany({ where: { status: "ACTIVE" }, orderBy: { sortOrder: "asc" } }),
    prisma.transactionItem.findMany({
      where: { transaction: { status: "COMPLETED", createdAt: { gte: start, lte: end } } },
      select: TX_ITEM_SELECT,
    }),
    prisma.attendanceRecord.findMany({ where: { date: { gte: start, lte: end } }, include: ATTENDANCE_INCLUDE }),
  ]);

  const txItemsByOutlet = new Map<string, TxItemRow[]>();
  for (const item of allTxItems) {
    const list = txItemsByOutlet.get(item.transaction.outletId) ?? [];
    list.push(item);
    txItemsByOutlet.set(item.transaction.outletId, list);
  }
  const attendanceByOutlet = new Map<string, AttendanceRow[]>();
  for (const a of allAttendance) {
    const list = attendanceByOutlet.get(a.outletId) ?? [];
    list.push(a);
    attendanceByOutlet.set(a.outletId, list);
  }

  const perOutlet = await Promise.all(
    outlets.map(async (outlet) => {
      const omset = await getOmsetSheet(outlet.id, year, month, catalog, txItemsByOutlet.get(outlet.id) ?? []);
      // Skip the roster/bracket query entirely for an outlet with no sales
      // this month — cheap short-circuit so looping every active outlet
      // (most of which have no activity in a given demo period) stays fast.
      if (omset.days.every((d) => d.totalOmset === 0)) return [];
      const roster = await getDailyRoster(outlet.id, year, month, omset, brackets, attendanceByOutlet.get(outlet.id) ?? []);

      const rows: DailyIncentiveRow[] = [];
      for (const day of roster.days) {
        if (day.present.length === 0) continue;
        const insentifPerSlot = incentiveValuePerSlot(day);
        for (const person of day.present) {
          const weight = incentiveSlotWeight(day.present, person);
          rows.push({
            date: day.date,
            outletName: outlet.name,
            omset: day.omset,
            ratePercent: day.rateUsed,
            plafonLabel: day.bracket?.label ?? "-",
            pramuniagaName: person.name,
            pramuniagaKey: person.rosterKey ?? person.userId,
            shift: person.shift,
            qtyPramuniaga: weight,
            insentifPerPramu: insentifPerSlot * weight,
          });
        }
      }
      return rows;
    }),
  );

  return perOutlet.flat().sort((a, b) => a.date.getTime() - b.date.getTime() || a.outletName.localeCompare(b.outletName));
}

// ═══════════════════════════════════════════════════════════════════════
// "Pencapaian Target Outlet" — every active outlet's monthly Omset target
// vs. actual net sales, one row each, for the company-wide achievement
// list (FA Outlet menu). Target = OutletMonthlyTarget.monthlyTarget for
// the period (falls back to the outlet's static Outlet.monthlyTarget when
// no monthly row exists yet, same fallback convention as everywhere else
// this field is used). Actual = sum of COMPLETED transaction totals that
// month — the same Omset figure the Insentive Sheet's own monthly gate
// (monthlyAchieved) is built from, just aggregated across every outlet in
// one query instead of one outlet at a time.
// Kategori: >=100% "Achv Target", 80-99.99% "Dapat Insentive", <80%
// "Tidak dapat Insentive" — the business only names the two endpoints
// (100% and 80%) explicitly; the middle band is this report's own
// completion of that same two-threshold scheme.
// ═══════════════════════════════════════════════════════════════════════
export type OutletTargetAchievementRow = {
  outletId: string;
  outletName: string;
  area: string;
  target: number;
  actual: number;
  pct: number;
  kategori: "ACHV_TARGET" | "DAPAT_INSENTIVE" | "TIDAK_DAPAT_INSENTIVE";
};

export async function getOutletTargetAchievement(year: number, month: number): Promise<OutletTargetAchievementRow[]> {
  const { start, end } = monthRange(year, month);
  const [outlets, monthlyTargets, actualByOutlet] = await Promise.all([
    prisma.outlet.findMany({ where: { status: "ACTIVE" }, include: { region: true }, orderBy: { name: "asc" } }),
    prisma.outletMonthlyTarget.findMany({ where: { year, month } }),
    prisma.transaction.groupBy({ by: ["outletId"], where: { status: "COMPLETED", createdAt: { gte: start, lte: end } }, _sum: { total: true } }),
  ]);

  const targetByOutletId = new Map(monthlyTargets.map((t) => [t.outletId, Number(t.monthlyTarget)]));
  const actualMap = new Map(actualByOutlet.map((a) => [a.outletId, Number(a._sum.total ?? 0)]));

  return outlets.map((o) => {
    const target = targetByOutletId.get(o.id) ?? Number(o.monthlyTarget);
    const actual = actualMap.get(o.id) ?? 0;
    const pct = target > 0 ? (actual / target) * 100 : 0;
    const kategori: OutletTargetAchievementRow["kategori"] = pct >= 100 ? "ACHV_TARGET" : pct >= 80 ? "DAPAT_INSENTIVE" : "TIDAK_DAPAT_INSENTIVE";
    return { outletId: o.id, outletName: o.name, area: o.region.name, target, actual, pct, kategori };
  });
}

// Same short-code scheme as the outlet detail page's own outletShortCode
// (consonants-only, first 4 letters) — duplicated here rather than
// imported since it's a tiny pure helper and this module shouldn't import
// FROM a page.
function shortCode(name: string): string {
  const consonantsOnly = name.replace(/[aiueoAIUEO]/g, "").replace(/[^A-Za-z]/g, "");
  return (consonantsOnly || name.replace(/[^A-Za-z]/g, "")).slice(0, 4).toUpperCase();
}

// ═══════════════════════════════════════════════════════════════════════
// "Laporan Rekapitulasi Insentive" — company-wide, one month, 4 views over
// the exact same gated pramuniaga-bracket incentive the Insentive Sheet
// computes per outlet (see getDailyRoster's JPD+omset gate): Per Outlet
// (one row per outlet), Per Pramuniaga (one row per person per outlet,
// since the same person can work more than one outlet in a month), and
// Diberikan/Tidak Diberikan — the same per-person-per-outlet rows split by
// whether that outlet's gate passed that month, with Tidak Diberikan
// additionally showing what was CALCULATED (pre-gate) vs. what's actually
// paid (always 0 there) and why (ALASAN).
// ═══════════════════════════════════════════════════════════════════════
export type InsentiveRekapOutletRow = {
  outletId: string;
  outletName: string;
  kode: string;
  area: string;
  omsetQty: number;
  avgSales: number;
  avgBeefUsed: number;
  insentiveOperator: number;
  gatePassed: boolean;
};
export type InsentiveRekapPramuniagaRow = {
  outletId: string;
  outletName: string;
  kode: string;
  rosterKey: string;
  userId: string;
  pramuniagaName: string;
  qty: number;
  insentive: number;
  gatePassed: boolean;
};
export type InsentiveRekapTidakDiberikanRow = InsentiveRekapPramuniagaRow & {
  calculated: number;
  alasan: string;
};

export async function getInsentiveRekapitulasi(year: number, month: number) {
  const { start, end } = monthRange(year, month);
  // Every active outlet computed in PARALLEL (not one-at-a-time) — same
  // batching convention as getCompanyDailyIncentiveBreakdown, needed here
  // too since this loops every outlet instead of one (sequential was
  // timing out past 40s for 60+ outlets). Transaction items are fetched
  // ONCE company-wide and sliced per outlet (getOmsetSheet's own preload
  // hook); getAbsenSheet's attendance/payroll queries stay per-outlet —
  // still fine run in parallel, this report just isn't on the hot path
  // the adjustment page is.
  const [outlets, catalog, allTxItems] = await Promise.all([
    prisma.outlet.findMany({ where: { status: "ACTIVE" }, include: { region: true }, orderBy: { name: "asc" } }),
    loadOmsetCatalog(),
    prisma.transactionItem.findMany({
      where: { transaction: { status: "COMPLETED", createdAt: { gte: start, lte: end } } },
      select: TX_ITEM_SELECT,
    }),
  ]);

  const txItemsByOutlet = new Map<string, TxItemRow[]>();
  for (const item of allTxItems) {
    const list = txItemsByOutlet.get(item.transaction.outletId) ?? [];
    list.push(item);
    txItemsByOutlet.set(item.transaction.outletId, list);
  }

  const perOutlet = await Promise.all(
    outlets.map(async (outlet) => {
      const omset = await getOmsetSheet(outlet.id, year, month, catalog, txItemsByOutlet.get(outlet.id) ?? []);
      if (omset.days.every((d) => d.totalOmset === 0)) return null; // no activity — skip, not "zero"

      const jpd = await getJpdSheet(outlet.id, year, month, omset);
      // getAbsenSheet already runs getDailyRoster internally and exposes
      // everything needed (rosterDays, the gate breakdown, per-person
      // insentiveValue/insentiveValueRaw) — no need for a second, separate
      // getDailyRoster call here.
      const absen = await getAbsenSheet(outlet.id, year, month, omset, jpd.finalAvgYield);
      const kode = shortCode(outlet.name);

      const insentiveOperator = absen.rosterDays.reduce((s, d) => s + d.totalInsentifHari, 0);
      const outletRow: InsentiveRekapOutletRow = {
        outletId: outlet.id,
        outletName: outlet.name,
        kode,
        area: outlet.region.name,
        omsetQty: absen.totalQtySales,
        avgSales: absen.avgSalesPerAbsen,
        avgBeefUsed: absen.totalStandbyAll > 0 ? jpd.totalDagingKg / absen.totalStandbyAll : 0,
        insentiveOperator,
        gatePassed: absen.gatePassed,
      };

      const alasanParts: string[] = [];
      if (absen.jpdAvgYield !== null) {
        alasanParts.push(`JPD ${absen.jpdAvgYield.toFixed(3).replace(/\.?0+$/, "").replace(".", ",")} ${absen.jpdGatePassed ? "mencapai" : "belum mencapai"} target 75`);
      }
      if (absen.monthlyTarget > 0) {
        const pct = absen.achievementPct ?? 0;
        alasanParts.push(`omset ${pct.toFixed(0)}% ${absen.omsetGatePassed ? "sudah melewati" : "belum melewati"} 80% target`);
      }
      const alasan = alasanParts.join("; ") || "-";

      const pramRows: InsentiveRekapPramuniagaRow[] = [];
      const tidakRows: InsentiveRekapTidakDiberikanRow[] = [];
      for (const r of absen.rows) {
        pramRows.push({
          outletId: outlet.id,
          outletName: outlet.name,
          kode,
          rosterKey: r.rosterKey,
          userId: r.userId,
          pramuniagaName: r.name,
          qty: r.qtySales,
          insentive: r.insentiveValue,
          gatePassed: absen.gatePassed,
        });
        if (!absen.gatePassed) {
          tidakRows.push({
            outletId: outlet.id,
            outletName: outlet.name,
            kode,
            rosterKey: r.rosterKey,
            userId: r.userId,
            pramuniagaName: r.name,
            qty: r.qtySales,
            insentive: 0,
            calculated: r.insentiveValueRaw,
            gatePassed: false,
            alasan,
          });
        }
      }

      return { outletRow, pramRows, tidakRows };
    }),
  );

  const outletRows = perOutlet.filter((x) => x !== null).map((x) => x.outletRow);
  const pramuniagaRows = perOutlet.filter((x) => x !== null).flatMap((x) => x.pramRows);
  const tidakDiberikanRows = perOutlet.filter((x) => x !== null).flatMap((x) => x.tidakRows);

  // Grouped (raw, not-yet-paid) total per PERSON across every outlet of
  // theirs that didn't clear the gate this month — "Ditahan" in the
  // business's own spreadsheet, i.e. what Diberikan would show as TOTAL
  // if the gate had passed everywhere, kept visible so nothing silently
  // disappears.
  const groupedByPerson = new Map<string, number>();
  for (const r of tidakDiberikanRows) groupedByPerson.set(r.rosterKey, (groupedByPerson.get(r.rosterKey) ?? 0) + r.calculated);

  outletRows.sort((a, b) => a.outletName.localeCompare(b.outletName));
  pramuniagaRows.sort((a, b) => a.pramuniagaName.localeCompare(b.pramuniagaName) || a.outletName.localeCompare(b.outletName));
  tidakDiberikanRows.sort((a, b) => a.pramuniagaName.localeCompare(b.pramuniagaName) || a.outletName.localeCompare(b.outletName));

  return { outletRows, pramuniagaRows, tidakDiberikanRows, groupedByPerson };
}

// ═══════════════════════════════════════════════════════════════════════
// "Laporan Fullshift" — per pramuniaga, how many days in the selected
// period their outlet's daily Omset reached the outlet's Fullshift Daily
// Target while they were on duty, against an annual quota, paid at a flat
// Rp50.000/day. See the 3 field definitions below for the exact formulas
// (confirmed with the business 2026-10-12).
//
//   Target Fullshift = (annual Omset target ÷ Fullshift Daily Target) ×
//     75% — a day-count quota for the YEAR containing the period's start
//     date, independent of how long the selected period itself is.
//     Annual target = Σ OutletMonthlyTarget.monthlyTarget for that
//     outlet/year (falls back to Outlet.monthlyTarget × 12 for any month
//     with no row). Fullshift Daily Target = OutletMonthlyTarget
//     .fullshiftDailyTarget for the period's start month (falls back to
//     Outlet.fullshiftTarget).
//   Jumlah Achieve Fullshift = count of days within the selected period
//     where that outlet's daily Omset >= that day's own month's
//     Fullshift Daily Target, counted only for days the pramuniaga was
//     present (PRESENT/LATE attendance) that day.
//   Nominal Fullshift = Jumlah Achieve Fullshift × Rp50.000.
// ═══════════════════════════════════════════════════════════════════════
const FULLSHIFT_RATE = 50000;

function monthsBetween(start: Date, end: Date): { year: number; month: number }[] {
  const months: { year: number; month: number }[] = [];
  let y = start.getUTCFullYear();
  let m = start.getUTCMonth() + 1;
  const endY = end.getUTCFullYear();
  const endM = end.getUTCMonth() + 1;
  while (y < endY || (y === endY && m <= endM)) {
    months.push({ year: y, month: m });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return months;
}

export type FullshiftReportRow = {
  outletId: string;
  outletName: string;
  area: string;
  userId: string;
  pramuniagaKey: string;
  pramuniagaName: string;
  targetFullshift: number;
  jumlahAchieve: number;
  nominalFullshift: number;
};

export async function getFullshiftReport(params: {
  start: Date;
  end: Date;
  outletId?: string;
  pramuniagaId?: string;
}): Promise<FullshiftReportRow[]> {
  const { start, end, outletId, pramuniagaId } = params;
  const months = monthsBetween(start, end);
  const annualTargetYear = start.getUTCFullYear();

  // Transaction items for the whole period, every outlet, fetched ONCE and
  // sliced per outlet (getOmsetSheet's preload hook) — same batching
  // convention as getCompanyDailyIncentiveBreakdown/getInsentiveRekapitulasi.
  // Outlets themselves are then processed in PARALLEL (was a fully
  // sequential outlet x month loop — ~40s for 60+ outlets; this cut it
  // down the same way the Rekapitulasi Insentive fix did).
  const [outlets, catalog, brackets, annualTargets, periodTargets, allTxItems] = await Promise.all([
    prisma.outlet.findMany({ where: { status: "ACTIVE", ...(outletId ? { id: outletId } : {}) }, include: { region: true }, orderBy: { name: "asc" } }),
    loadOmsetCatalog(),
    prisma.incentiveBracket.findMany({ where: { status: "ACTIVE" }, orderBy: { sortOrder: "asc" } }),
    prisma.outletMonthlyTarget.findMany({ where: { year: annualTargetYear } }),
    prisma.outletMonthlyTarget.findMany({ where: { OR: months.map((m) => ({ year: m.year, month: m.month })) } }),
    prisma.transactionItem.findMany({
      where: { transaction: { status: "COMPLETED", createdAt: { gte: start, lte: end } } },
      select: TX_ITEM_SELECT,
    }),
  ]);
  const txItemsByOutlet = new Map<string, TxItemRow[]>();
  for (const item of allTxItems) {
    const list = txItemsByOutlet.get(item.transaction.outletId) ?? [];
    list.push(item);
    txItemsByOutlet.set(item.transaction.outletId, list);
  }

  const annualTargetByOutlet = new Map<string, number>();
  for (const o of outlets) {
    let sum = 0;
    for (let m = 1; m <= 12; m++) {
      const row = annualTargets.find((t) => t.outletId === o.id && t.month === m);
      sum += row ? Number(row.monthlyTarget) : Number(o.monthlyTarget);
    }
    annualTargetByOutlet.set(o.id, sum);
  }
  const fullshiftDailyTargetByOutletMonth = new Map<string, number>();
  for (const t of periodTargets) fullshiftDailyTargetByOutletMonth.set(`${t.outletId}:${t.year}-${t.month}`, Number(t.fullshiftDailyTarget));
  function fullshiftDailyTarget(outlet: (typeof outlets)[number], year: number, month: number): number {
    return fullshiftDailyTargetByOutletMonth.get(`${outlet.id}:${year}-${month}`) || Number(outlet.fullshiftTarget);
  }
  function startMonthFullshiftDailyTarget(outlet: (typeof outlets)[number]): number {
    return fullshiftDailyTarget(outlet, start.getUTCFullYear(), start.getUTCMonth() + 1);
  }

  const perOutlet = await Promise.all(
    outlets.map(async (outlet) => {
      const dailyTarget = startMonthFullshiftDailyTarget(outlet);
      const annualTarget = annualTargetByOutlet.get(outlet.id) ?? 0;
      const targetFullshift = dailyTarget > 0 ? (annualTarget / dailyTarget) * 0.75 : 0;

      const rowsByPerson = new Map<string, FullshiftReportRow>();
      for (const { year, month } of months) {
        const omset = await getOmsetSheet(outlet.id, year, month, catalog, txItemsByOutlet.get(outlet.id) ?? []);
        const roster = await getDailyRoster(outlet.id, year, month, omset, brackets);
        const dayTarget = fullshiftDailyTarget(outlet, year, month);

        for (const day of roster.days) {
          if (day.date < start || day.date > end) continue;
          const achievedToday = dayTarget > 0 && day.omset >= dayTarget;
          for (const person of day.present) {
            if (pramuniagaId && person.userId !== pramuniagaId) continue;
            const key = person.rosterKey ?? person.userId;
            // Row created on PRESENCE, not achievement — every pramuniaga
            // who was on duty any day this period appears, even with 0
            // achieve days, so the report reads as a complete roster
            // against quota, not just a list of who happened to hit target.
            const row =
              rowsByPerson.get(key) ??
              ({
                outletId: outlet.id,
                outletName: outlet.name,
                area: outlet.region.name,
                userId: person.userId,
                pramuniagaKey: key,
                pramuniagaName: person.name,
                targetFullshift,
                jumlahAchieve: 0,
                nominalFullshift: 0,
              } satisfies FullshiftReportRow);
            if (achievedToday) {
              row.jumlahAchieve += 1;
              row.nominalFullshift = row.jumlahAchieve * FULLSHIFT_RATE;
            }
            rowsByPerson.set(key, row);
          }
        }
      }
      return [...rowsByPerson.values()];
    }),
  );

  return perOutlet.flat().sort((a, b) => a.outletName.localeCompare(b.outletName) || a.pramuniagaName.localeCompare(b.pramuniagaName));
}

// ═══════════════════════════════════════════════════════════════════════
// "Summary Gaji & Tunjangan" — a compact rollup of figures already
// computed by the Absen/Insentive/Report sheets above, reshaped into the
// business's own one-page format (stat cards + per-pramuniaga table +
// BIAYA/SYARAT TUNJANGAN panels). Deliberately does NOT recompute Qty
// Sales, Labor Cost, Royalti, Insentive Officer/Head, AVG Sales/Beef, or
// Laba — those stay sourced from absen/insentive/report so this panel can
// never drift from the Absen/Insentive/Report Sheets' own numbers. Only
// genuinely new here: Total Absen override, REF weight, Share Value (the
// Tunjangan Tahunan pool split by qtySales × ref), and the 4 flat BIAYA
// figures with no other source yet (OutletMonthlyBenefit).
//
// Laba Operasional is taken as Report Sheet's LABA/RUGI BERSIH (after all
// overhead) — adjust here if the business means something narrower by
// "Operasional" (e.g. gross margin before overhead).
// ═══════════════════════════════════════════════════════════════════════
export type GajiTunjanganRow = {
  userId: string;
  rosterKey: string;
  name: string;
  qtySales: number;
  laborCost: number;
  totalAbsen: number;
  totalAbsenIsOverride: boolean;
  salary: number;
  ref: number;
  shareValue: number;
};

export async function getGajiTunjanganSummary(
  outletId: string,
  outletName: string,
  year: number,
  month: number,
  absen: Awaited<ReturnType<typeof getAbsenSheet>>,
  insentive: Awaited<ReturnType<typeof getInsentiveSheet>>,
  jpd: Awaited<ReturnType<typeof getJpdSheet>>,
  labaOperasional: number,
) {
  const [payrolls, benefit] = await Promise.all([
    prisma.outletPayroll.findMany({ where: { outletId, year, month } }),
    prisma.outletMonthlyBenefit.findUnique({ where: { outletId_year_month: { outletId, year, month } } }),
  ]);
  const payrollByUserId = new Map(payrolls.map((p) => [p.userId, p]));

  const tunjanganTahunan = labaOperasional * 0.02;
  const weighted = absen.rows.map((r) => {
    const payroll = payrollByUserId.get(r.userId);
    const totalAbsenIsOverride = payroll?.totalAbsenOverride != null;
    const totalAbsen = totalAbsenIsOverride ? payroll!.totalAbsenOverride! : absen.nDays;
    const ref = payroll ? Number(payroll.refMultiplier) : 1;
    return { r, totalAbsen, totalAbsenIsOverride, ref, weight: r.qtySales * ref };
  });
  const totalWeight = weighted.reduce((s, w) => s + w.weight, 0);

  const rows: GajiTunjanganRow[] = weighted.map(({ r, totalAbsen, totalAbsenIsOverride, ref, weight }) => ({
    userId: r.userId,
    rosterKey: r.rosterKey,
    name: r.name,
    qtySales: r.qtySales,
    laborCost: r.laborCost,
    totalAbsen,
    totalAbsenIsOverride,
    salary: r.baseSalary,
    ref,
    shareValue: totalWeight > 0 ? (weight / totalWeight) * tunjanganTahunan : 0,
  }));

  return {
    outletName,
    omsetQty: absen.totalQtySales,
    avgSales: absen.avgSalesPerAbsen,
    avgBeef: insentive.avgBeef,
    labaOperasional,
    tunjanganTahunan,
    rows,
    totalQtySales: absen.totalQtySales,
    totalLaborCost: rows.reduce((s, r) => s + r.laborCost, 0),
    totalShareValue: rows.reduce((s, r) => s + r.shareValue, 0),
    biaya: {
      royalti: insentive.royalti,
      gajiOperator: rows.reduce((s, r) => s + r.laborCost, 0),
      // Now resolved — confirmed 2026-10-12 this is the pramuniaga bracket
      // incentive total (same figure the Insentive Sheet shows as
      // "Insentif Pramuniaga (Bracket)"), already gated by JPD>=75 AND
      // omset achievement>=80% (see getDailyRoster). The OutletMonthlyBenefit
      // field it used to read from stays in the schema as a manual override,
      // just unused by this panel now that the real formula is known.
      insentiveOperator: insentive.totalInsentifHari,
      insentiveOfficer: insentive.insentiveOfficer,
      insentiveHead: insentive.insentiveHead,
      tunjanganOutlet: Number(benefit?.tunjanganOutlet ?? 0),
      tunjanganTahunan,
      gajiPengelola: Number(benefit?.gajiPengelola ?? 0),
      fullshift: Number(benefit?.fullshiftAmount ?? 0),
    },
    syaratTunjangan: {
      avgSalesPerHariMin: 50,
      jpdMin: 75,
      avgSales: absen.avgSalesPerAbsen,
      avgSalesOk: absen.avgSalesPerAbsen > 50,
      jpd: jpd.finalAvgYield,
      jpdOk: jpd.finalAvgYield > 75,
      targetTercapai: insentive.monthlyAchieved >= insentive.monthlyTarget && insentive.monthlyTarget > 0,
      monthlyAchieved: insentive.monthlyAchieved,
      monthlyTarget: insentive.monthlyTarget,
    },
  };
}
