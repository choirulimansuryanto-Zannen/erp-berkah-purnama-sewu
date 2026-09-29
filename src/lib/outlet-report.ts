import "server-only";
import { prisma } from "@/lib/prisma";
import { CHANNEL_LABELS } from "@/components/transactions/channel-badge";

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
// Rusak/Reject/Selisih).
// ═══════════════════════════════════════════════════════════════════════
export async function getAdjustmentSheet(outletId: string, year: number, month: number) {
  const { start, end } = monthRange(year, month);
  const rows = await prisma.outletAdjustment.findMany({
    where: { outletId, date: { gte: start, lte: end } },
    include: { material: { select: { name: true } }, createdBy: { select: { name: true } } },
    orderBy: { date: "asc" },
  });
  const byType = { RUSAK: 0, REJECT: 0, SELISIH: 0 } as Record<string, number>;
  const qtyByType = { RUSAK: 0, REJECT: 0, SELISIH: 0 } as Record<string, number>;
  for (const r of rows) {
    byType[r.type] += Number(r.amount);
    qtyByType[r.type] += Number(r.qty);
  }
  const total = byType.RUSAK + byType.REJECT + byType.SELISIH;
  return { rows, byType, qtyByType, total };
}

// ═══════════════════════════════════════════════════════════════════════
// g. Inventory Sheet — "Data Stock Available": every OutletMaterial's
// Awal/Masuk/Keluar(Pakai+Rusak+ADJ)/Saldo, qty + nominal, grouped by
// category. Awal Masuk/Rusak/Selisih all have a real source; Pakai is the
// residual (Awal + Masuk - Rusak - Reject - Selisih - Akhir) — the same
// "back out the plug" approach FA Company's own HPP report uses, since
// there's no per-product recipe/BOM tracked to compute it directly.
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
  for (const a of adjustmentsMonth) {
    const map = a.type === "RUSAK" ? rusakByMaterial : a.type === "REJECT" ? rejectByMaterial : selisihByMaterial;
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
    const akhirRecorded = akhirByMaterial.has(m.id);
    const akhirQty = akhirByMaterial.get(m.id) ?? awalQty + masukQty - rusakQty - rejectQty - selisihQty;
    const pakaiQty = awalQty + masukQty - rusakQty - rejectQty - selisihQty - akhirQty;
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
// d. Akun Sheet — A. Penjualan (per channel, incl. Potongan) -> Total
// Penjualan; B. Pembelian (HPP build-up) -> Laba/Rugi Kotor; C. Biaya
// (Overhead Langsung/Tidak Langsung, from ExpenseCategoryDef's group) ->
// Laba/Rugi Bersih.
// ═══════════════════════════════════════════════════════════════════════
const SALES_CHANNEL_ORDER = ["CASH", "GOFOOD", "GRAB", "TIKTOK", "SHOPEE", "QPON", "CASHLESS"] as const;

export async function getAkunSheet(outletId: string, year: number, month: number, purchaseSheet: Awaited<ReturnType<typeof getPurchaseSheet>>) {
  const { start, end } = monthRange(year, month);

  const [channelTotals, expenseCategoryTotals, materialAwal, materialAkhir] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["channel"],
      where: { outletId, status: "COMPLETED", createdAt: { gte: start, lte: end } },
      _sum: { total: true, discount: true },
    }),
    prisma.expenseRecord.groupBy({
      by: ["category"],
      where: { outletId, approvalStatus: "APPROVED", date: { gte: start, lte: end } },
      _sum: { amount: true },
    }),
    getInventorySheet(outletId, year, month), // reused for beginning/ending BAHAN_UTAMA+BAHAN_BAKU_TAMBAHAN stock value
    Promise.resolve(null),
  ]);
  void materialAkhir;

  const penjualanRows = SALES_CHANNEL_ORDER.map((channel) => {
    const row = channelTotals.find((c) => c.channel === channel);
    return { channel, label: CHANNEL_LABELS[channel] ?? channel, penjualan: Number(row?._sum.total ?? 0), potongan: Number(row?._sum.discount ?? 0) };
  }).filter((r) => r.penjualan > 0 || r.potongan > 0);
  const totalPenjualanKotor = penjualanRows.reduce((s, r) => s + r.penjualan, 0);
  const totalPotongan = penjualanRows.reduce((s, r) => s + r.potongan, 0);
  const totalPenjualan = totalPenjualanKotor - totalPotongan;

  const categoryDefs = await prisma.expenseCategoryDef.findMany({ orderBy: { sortOrder: "asc" } });
  const expenseByKey = new Map(expenseCategoryTotals.map((e) => [e.category, Number(e._sum.amount ?? 0)]));

  // B. PEMBELIAN — bahan baku stock movement (Awal/Akhir from the raw-
  // material categories) + this month's purchases + the SAYUR/GAS expense
  // categories that were historically recorded as "expenses" but really
  // belong here.
  const bahanBakuMaterials = materialAwal.rows.filter((r) => r.category === "BAHAN_UTAMA" || r.category === "BAHAN_BAKU_TAMBAHAN");
  const persediaanAwal = bahanBakuMaterials.reduce((s, r) => s + r.awalQty * r.unitPrice, 0);
  const persediaanAkhir = bahanBakuMaterials.reduce((s, r) => s + r.akhirQty * r.unitPrice, 0);
  const pembelianSayur = expenseByKey.get("SAYUR") ?? 0;
  const pembelianGas = expenseByKey.get("GAS_3KG") ?? 0;

  const pembelianRows = [
    { label: "Persediaan Barang Awal", amount: persediaanAwal },
    { label: "Pembelian Bahan (Barang Masuk)", amount: purchaseSheet.totalReceived + (purchaseSheet.manualRows.filter((r) => r.category === "BAHAN").reduce((s, r) => s + r.amount, 0)) },
    { label: "Pembelian Bahan (Eksternal)", amount: purchaseSheet.manualRows.filter((r) => r.category === "BAHAN_EKSTERNAL").reduce((s, r) => s + r.amount, 0) },
    { label: "Bahan & Alat Pendukung", amount: purchaseSheet.manualRows.filter((r) => r.category === "BAHAN_PENDUKUNG").reduce((s, r) => s + r.amount, 0) },
    { label: "Pembelian Sayur", amount: pembelianSayur + purchaseSheet.manualRows.filter((r) => r.category === "SAYUR").reduce((s, r) => s + r.amount, 0) },
    { label: "Pembelian Gas", amount: pembelianGas + purchaseSheet.manualRows.filter((r) => r.category === "GAS").reduce((s, r) => s + r.amount, 0) },
    { label: "Biaya Angkut Pembelian", amount: purchaseSheet.manualRows.filter((r) => r.category === "ANGKUT").reduce((s, r) => s + r.amount, 0) },
    { label: "Potongan Pembelian", amount: -purchaseSheet.manualRows.filter((r) => r.category === "POTONGAN").reduce((s, r) => s + r.amount, 0) },
    { label: "Persediaan Barang Akhir", amount: -persediaanAkhir },
  ];
  const totalHpp = pembelianRows.reduce((s, r) => s + r.amount, 0);
  const labaKotor = totalPenjualan - totalHpp;

  function overheadRows(group: "DIRECT" | "INDIRECT") {
    return categoryDefs
      .filter((c) => c.overheadGroup === group)
      .map((c) => ({ label: c.label, amount: expenseByKey.get(c.key) ?? 0 }))
      .filter((r) => r.amount > 0);
  }
  const overheadLangsungRows = overheadRows("DIRECT");
  const overheadTidakLangsungRows = overheadRows("INDIRECT");
  const totalOverheadLangsung = overheadLangsungRows.reduce((s, r) => s + r.amount, 0);
  const totalOverheadTidakLangsung = overheadTidakLangsungRows.reduce((s, r) => s + r.amount, 0);
  const totalBiaya = totalOverheadLangsung + totalOverheadTidakLangsung;
  const labaBersih = labaKotor - totalBiaya;

  return {
    penjualanRows,
    totalPenjualanKotor,
    totalPotongan,
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
// e+f. Absen + Insentive Sheet — per-employee daily attendance, each day's
// Omset picked into exactly one IncentiveBracket by range, that bracket's
// rate (single-PIC vs multi-PIC, by how many pramuniaga were present that
// day) applied to the day's Omset, then split evenly across whoever was
// present. Bracket thresholds/rates are admin-editable
// (/admin/incentive-brackets) — verify against the real payroll numbers.
// ═══════════════════════════════════════════════════════════════════════
export async function getAbsenInsentiveSheet(outletId: string, year: number, month: number) {
  const { start, end } = monthRange(year, month);
  const [attendance, brackets, dailyReports] = await Promise.all([
    prisma.attendanceRecord.findMany({ where: { outletId, date: { gte: start, lte: end } }, include: { user: { select: { id: true, name: true } } } }),
    prisma.incentiveBracket.findMany({ where: { status: "ACTIVE" }, orderBy: { sortOrder: "asc" } }),
    prisma.dailyReport.findMany({ where: { outletId, status: "APPROVED", date: { gte: start, lte: end } } }),
  ]);

  const omsetByDay = new Map<string, number>();
  for (const r of dailyReports) omsetByDay.set(r.date.toISOString().slice(0, 10), Number(r.omset));

  const presentByDay = new Map<string, { userId: string; name: string }[]>();
  for (const a of attendance) {
    if (a.status !== "PRESENT" && a.status !== "LATE") continue;
    const key = a.date.toISOString().slice(0, 10);
    const list = presentByDay.get(key) ?? [];
    if (!list.some((p) => p.userId === a.userId)) list.push({ userId: a.userId, name: a.user.name });
    presentByDay.set(key, list);
  }

  function bracketFor(omset: number) {
    return brackets.find((b) => omset >= Number(b.rangeMin) && (b.rangeMax === null || omset <= Number(b.rangeMax)));
  }

  const byEmployee = new Map<string, { name: string; hadir: number; insentif: number }>();
  const nDays = daysInMonth(year, month);
  for (let d = 1; d <= nDays; d++) {
    const dateKey = new Date(Date.UTC(year, month - 1, d)).toISOString().slice(0, 10);
    const omset = omsetByDay.get(dateKey) ?? 0;
    const present = presentByDay.get(dateKey) ?? [];
    if (present.length === 0 || omset <= 0) continue;
    const bracket = bracketFor(omset);
    if (!bracket) continue;
    const rate = present.length > 1 ? Number(bracket.rateMultiPic) : Number(bracket.rateSinglePic);
    const dayIncentiveTotal = (omset * rate) / 100;
    const perPerson = dayIncentiveTotal / present.length;
    for (const p of present) {
      const entry = byEmployee.get(p.userId) ?? { name: p.name, hadir: 0, insentif: 0 };
      entry.hadir += 1;
      entry.insentif += perPerson;
      byEmployee.set(p.userId, entry);
    }
  }

  const employees = [...byEmployee.values()].sort((a, b) => b.insentif - a.insentif);
  const totalInsentif = employees.reduce((s, e) => s + e.insentif, 0);
  return { employees, totalInsentif, bracketsConfigured: brackets.length > 0 };
}
