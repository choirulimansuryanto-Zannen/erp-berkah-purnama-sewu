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

export async function getOmsetSheet(outletId: string, year: number, month: number) {
  const { start, end } = monthRange(year, month);
  const [txItems, products, toppings, packageComponents] = await Promise.all([
    prisma.transactionItem.findMany({
      where: { transaction: { outletId, status: "COMPLETED", createdAt: { gte: start, lte: end } } },
      select: {
        qty: true,
        productId: true,
        toppings: { select: { toppingId: true, qty: true } },
        transaction: { select: { createdAt: true, total: true } },
      },
    }),
    prisma.product.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.topping.findMany({ orderBy: { name: "asc" } }),
    prisma.packageComponent.findMany({ select: { packageProductId: true, componentProductId: true, componentToppingId: true, qty: true } }),
  ]);

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
// b. Purchase Sheet — OutletPurchase entries PLUS "barang masuk" already
// recorded on the pramuniaga side (InventoryRecord.received), since the
// business explicitly wants Purchase Sheet driven by that existing data,
// not a second manual entry for the same physical event.
// ═══════════════════════════════════════════════════════════════════════
export async function getPurchaseSheet(outletId: string, year: number, month: number) {
  const { start, end } = monthRange(year, month);
  const [manualPurchases, receivedRecords] = await Promise.all([
    prisma.outletPurchase.findMany({
      where: { outletId, date: { gte: start, lte: end } },
      include: { createdBy: { select: { name: true } }, material: { select: { name: true } } },
      orderBy: { date: "asc" },
    }),
    prisma.inventoryRecord.findMany({
      where: { outletId, date: { gte: start, lte: end }, received: { gt: 0 } },
      include: { product: { select: { name: true, cost: true } } },
      orderBy: { date: "asc" },
    }),
  ]);

  const receivedRows = receivedRecords.map((r) => ({
    date: r.date,
    description: `Barang Masuk — ${r.product.name}`,
    qty: r.received,
    unit: "pcs",
    amount: r.received * Number(r.product.cost),
    source: "pramuniaga" as const,
  }));
  const manualRows = manualPurchases.map((p) => ({
    id: p.id,
    date: p.date,
    description: p.material ? `${p.description} (${p.material.name})` : p.description,
    category: p.category,
    qty: Number(p.qty),
    unit: p.unit,
    amount: Number(p.amount),
    createdBy: p.createdBy.name,
    source: "manual" as const,
  }));

  const totalReceived = receivedRows.reduce((s, r) => s + r.amount, 0);
  const totalManual = manualRows.reduce((s, r) => s + r.amount, 0);
  return { receivedRows, manualRows, totalReceived, totalManual, total: totalReceived + totalManual };
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
  present: { userId: string; name: string }[];
  bracket: { label: string; rangeMin: number; rangeMax: number | null; rateSinglePic: number; rateMultiPic: number } | null;
  rateUsed: number;
  totalInsentifHari: number;
};

async function getDailyRoster(outletId: string, year: number, month: number, omset: Awaited<ReturnType<typeof getOmsetSheet>>) {
  const { start, end } = monthRange(year, month);
  const [attendance, brackets] = await Promise.all([
    prisma.attendanceRecord.findMany({ where: { outletId, date: { gte: start, lte: end } }, include: { user: { select: { id: true, name: true } } } }),
    prisma.incentiveBracket.findMany({ where: { status: "ACTIVE" }, orderBy: { sortOrder: "asc" } }),
  ]);

  const presentByDay = new Map<string, { userId: string; name: string }[]>();
  for (const a of attendance) {
    if (a.status !== "PRESENT" && a.status !== "LATE") continue;
    const key = a.date.toISOString().slice(0, 10);
    const list = presentByDay.get(key) ?? [];
    if (!list.some((p) => p.userId === a.userId)) list.push({ userId: a.userId, name: a.user.name });
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
    const totalInsentifHari = bracketRow && present.length > 0 ? (d.totalOmset * rateUsed) / 100 : 0;
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
      totalInsentifHari,
    };
  });

  return { days, bracketsConfigured: brackets.length > 0, brackets };
}

// ═══════════════════════════════════════════════════════════════════════
// e. Absen Sheet — one row per pramuniaga: a day-by-day attendance
// calendar (1..N, highlighting Ahad/Sunday), Qty Sales & Insentive Value
// (each day's total split evenly across whoever was present that day —
// same split the Insentive Sheet uses), Total Standby (days present),
// Masa non Insentive (days present but that day earned no incentive —
// zero Omset or no bracket matched), and Total Absen (days in the
// month). Labor Cost/Salary have no wage-rate/HR data model to compute
// from, so they're manually entered (OutletPayroll) instead of guessed at.
// ═══════════════════════════════════════════════════════════════════════
export type AbsenSheetRow = {
  userId: string;
  name: string;
  attendance: boolean[]; // length = days in month
  qtySales: number;
  insentiveValue: number;
  totalStandby: number;
  totalNonInsentif: number;
  laborCost: number;
  salary: number;
  payrollRecorded: boolean;
};

export async function getAbsenSheet(outletId: string, year: number, month: number, omset: Awaited<ReturnType<typeof getOmsetSheet>>) {
  const [roster, payrolls] = await Promise.all([
    getDailyRoster(outletId, year, month, omset),
    prisma.outletPayroll.findMany({ where: { outletId, year, month } }),
  ]);
  const nDays = daysInMonth(year, month);
  const payrollByUserId = new Map(payrolls.map((p) => [p.userId, p]));

  const byEmployee = new Map<string, AbsenSheetRow>();
  for (let i = 0; i < roster.days.length; i++) {
    const day = roster.days[i];
    const perPersonQty = day.present.length > 0 ? day.qtyAllProducts / day.present.length : 0;
    const perPersonInsentif = day.present.length > 0 ? day.totalInsentifHari / day.present.length : 0;
    for (const p of day.present) {
      const payroll = payrollByUserId.get(p.userId);
      const row = byEmployee.get(p.userId) ?? {
        userId: p.userId,
        name: p.name,
        attendance: new Array(nDays).fill(false),
        qtySales: 0,
        insentiveValue: 0,
        totalStandby: 0,
        totalNonInsentif: 0,
        laborCost: Number(payroll?.laborCost ?? 0),
        salary: Number(payroll?.salary ?? 0),
        payrollRecorded: Boolean(payroll),
      };
      row.attendance[i] = true;
      row.qtySales += perPersonQty;
      row.insentiveValue += perPersonInsentif;
      row.totalStandby += 1;
      if (!day.bracket || day.omset <= 0) row.totalNonInsentif += 1;
      byEmployee.set(p.userId, row);
    }
  }

  const rows = [...byEmployee.values()].sort((a, b) => b.qtySales - a.qtySales);
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
    openingDay: absen.nDays,
    royalti,
    insentiveOfficer,
    insentiveHead,
    omsetBersih: report.totalPenjualan,
    avgSales: absen.avgSalesPerAbsen,
    avgBeef: avgBeefPerAbsen,
  };
}

async function getOutletMonthlyOmsetForCompanyShare(year: number, month: number): Promise<number> {
  const { start, end } = monthRange(year, month);
  const agg = await prisma.dailyReport.aggregate({ where: { status: "APPROVED", date: { gte: start, lte: end } }, _sum: { omset: true } });
  return Number(agg._sum.omset ?? 0);
}
