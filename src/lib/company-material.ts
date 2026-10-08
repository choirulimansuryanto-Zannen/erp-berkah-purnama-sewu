import { prisma } from "@/lib/prisma";

// Company-wide (warehouse-level) SKU stock-opname — "Tabel SKU" on
// /finance/adjustment. Qty Saldo Awal, Qty Saldo Akhir, Harga/Cost, and
// Qty Faktur Outlet are directly editable per (item, year, month). Qty
// Total Bahan Baku and every Nominal figure are DERIVED here, never
// stored, so they can't drift from their inputs:
//   Nominal <X>        = Qty <X> × Harga/Cost   (for Saldo Awal, Saldo
//                                                 Akhir, Faktur Outlet,
//                                                 and Total Bahan Baku)
//   Qty Total Bahan Baku = Qty Saldo Awal − Qty Saldo Akhir − Qty Faktur Outlet
// (material consumed in production = what left the warehouse overall,
// minus what was invoiced out to outlets).

export const COMPANY_MATERIAL_CATEGORY_LABELS: Record<string, string> = {
  DAGING: "Daging",
  ROTI: "Roti",
  LABANESE: "Labanese",
  BAHAN_BAKU_TAMBAHAN: "Bahan Baku Tambahan AB",
  BAHAN_PENDUKUNG: "Bahan Pendukung AB",
  PACKAGING_AB: "Packaging AB",
  BAHAN_BAKU_AD: "Bahan Baku AD",
  BAHAN_CAMPURAN_AD: "Bahan Campuran AD",
  PACKAGING_AD: "Packaging AD",
  BARANG_JADI_AD: "Barang Jadi AD",
  MARKETING_TOOLS: "Marketing Tools MS",
};
export const COMPANY_MATERIAL_CATEGORY_ORDER = [
  "DAGING",
  "ROTI",
  "LABANESE",
  "BAHAN_BAKU_TAMBAHAN",
  "BAHAN_PENDUKUNG",
  "PACKAGING_AB",
  "BAHAN_BAKU_AD",
  "BAHAN_CAMPURAN_AD",
  "PACKAGING_AD",
  "BARANG_JADI_AD",
  "MARKETING_TOOLS",
] as const;

// Daging/Roti/Labanese are visually nested under one "Bahan Baku AB" parent
// banner in the source sheet (the other categories each stand on their
// own) — purely a rendering grouping, the underlying category stays flat.
export const COMPANY_MATERIAL_SUPER_GROUP: Record<string, string | null> = {
  DAGING: "Bahan Baku AB",
  ROTI: "Bahan Baku AB",
  LABANESE: "Bahan Baku AB",
  BAHAN_BAKU_TAMBAHAN: null,
  BAHAN_PENDUKUNG: null,
  PACKAGING_AB: null,
  BAHAN_BAKU_AD: null,
  BAHAN_CAMPURAN_AD: null,
  PACKAGING_AD: null,
  BARANG_JADI_AD: null,
  MARKETING_TOOLS: null,
};

// AB divisions (Daging/Roti/Labanese/Bahan Baku Tambahan/Bahan Pendukung/
// Packaging AB) + Marketing Tools = "Operasional"; AD divisions (Bahan
// Baku/Campuran/Packaging/Barang Jadi AD) = "Produksi" — the split the
// business's own bottom summary block uses (reverse-engineered from which
// categories its two subtotals actually add up to).
const OPERASIONAL_CATEGORIES = new Set(["DAGING", "ROTI", "LABANESE", "BAHAN_BAKU_TAMBAHAN", "BAHAN_PENDUKUNG", "PACKAGING_AB", "MARKETING_TOOLS"]);
const PRODUKSI_CATEGORIES = new Set(["BAHAN_BAKU_AD", "BAHAN_CAMPURAN_AD", "PACKAGING_AD", "BARANG_JADI_AD"]);

export type CompanyMaterialRow = {
  id: string;
  code: string;
  name: string;
  unit: string;
  costPerUnit: number;
  saldoAwalQty: number;
  saldoAwalNominal: number;
  qtyOpname: number; // Qty Saldo Akhir
  nilaiAkhir: number; // Nominal Saldo Akhir
  fakturOutletQty: number;
  fakturOutletNominal: number;
  totalBahanBakuQty: number; // derived — see module docblock
  totalBahanBakuNominal: number;
};

export type CompanyMaterialCategoryGroup = {
  category: string;
  label: string;
  superGroup: string | null;
  rows: CompanyMaterialRow[];
  totalSaldoAwalNominal: number;
  totalNilaiAkhir: number;
  totalFakturNominal: number;
  totalNominal: number;
};

function sumGroup(rows: CompanyMaterialRow[]) {
  return {
    totalSaldoAwalNominal: rows.reduce((s, r) => s + r.saldoAwalNominal, 0),
    totalNilaiAkhir: rows.reduce((s, r) => s + r.nilaiAkhir, 0),
    totalFakturNominal: rows.reduce((s, r) => s + r.fakturOutletNominal, 0),
    totalNominal: rows.reduce((s, r) => s + r.totalBahanBakuNominal, 0),
  };
}

function prevMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

export async function getCompanyMaterialSchedule(year: number, month: number) {
  const prev = prevMonth(year, month);

  const materials = await prisma.companyMaterial.findMany({
    where: { status: "ACTIVE" },
    include: { closingBalances: { where: { year, month } } },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });

  const allRows: (CompanyMaterialRow & { category: string })[] = materials.map((m) => {
    const cb = m.closingBalances[0];

    const costPerUnit = Number(cb?.costPerUnit ?? 0);
    const saldoAwalQty = Number(cb?.saldoAwalQty ?? 0);
    const qtyOpname = Number(cb?.qtyOpname ?? 0);
    const fakturOutletQty = Number(cb?.fakturOutletQty ?? 0);
    // Derived, not stored — see module docblock.
    const totalBahanBakuQty = saldoAwalQty - qtyOpname - fakturOutletQty;

    return {
      id: m.id,
      code: m.code,
      name: m.name,
      unit: m.unit,
      category: m.category,
      costPerUnit,
      saldoAwalQty,
      saldoAwalNominal: saldoAwalQty * costPerUnit,
      qtyOpname,
      nilaiAkhir: qtyOpname * costPerUnit,
      fakturOutletQty,
      fakturOutletNominal: fakturOutletQty * costPerUnit,
      totalBahanBakuQty,
      totalBahanBakuNominal: totalBahanBakuQty * costPerUnit,
    };
  });

  const groups: CompanyMaterialCategoryGroup[] = COMPANY_MATERIAL_CATEGORY_ORDER.filter((cat) => allRows.some((r) => r.category === cat)).map((cat) => {
    const rows = allRows.filter((r) => r.category === cat);
    return { category: cat, label: COMPANY_MATERIAL_CATEGORY_LABELS[cat], superGroup: COMPANY_MATERIAL_SUPER_GROUP[cat], rows, ...sumGroup(rows) };
  });

  const operasionalRows = allRows.filter((r) => OPERASIONAL_CATEGORIES.has(r.category));
  const produksiRows = allRows.filter((r) => PRODUKSI_CATEGORIES.has(r.category));
  const operasional = sumGroup(operasionalRows);
  const produksi = sumGroup(produksiRows);
  const grandTotal = {
    totalSaldoAwalNominal: operasional.totalSaldoAwalNominal + produksi.totalSaldoAwalNominal,
    totalNilaiAkhir: operasional.totalNilaiAkhir + produksi.totalNilaiAkhir,
    totalFakturNominal: operasional.totalFakturNominal + produksi.totalFakturNominal,
    totalNominal: operasional.totalNominal + produksi.totalNominal,
  };

  // "Account Summary" boxes — both are straightforward sums of the Tabel
  // SKU rows above: 4 Operasional sub-lines (Bahan Baku = Daging+Roti+
  // Labanese+Bahan Baku Tambahan combined; the other 3 stand alone) + the
  // 2 rollups, reverse-engineered from which categories each printed
  // line's total actually reconciles to.
  const accountSummary = [
    { label: "Bahan Baku", ...sumGroup(allRows.filter((r) => ["DAGING", "ROTI", "LABANESE", "BAHAN_BAKU_TAMBAHAN"].includes(r.category))) },
    { label: "Bahan Pendukung", ...sumGroup(allRows.filter((r) => r.category === "BAHAN_PENDUKUNG")) },
    { label: "Packaging", ...sumGroup(allRows.filter((r) => r.category === "PACKAGING_AB")) },
    { label: "Marketing Tools", ...sumGroup(allRows.filter((r) => r.category === "MARKETING_TOOLS")) },
    { label: "TOTAL OPERASIONAL", ...operasional },
    { label: "TOTAL PRODUKSI", ...produksi },
    { label: "TOTAL", ...grandTotal },
  ];

  // Next-month label for the "Faktur Outlet Tanggal 01 Bulan Selanjutnya" column header.
  const nextMonthIdx = month === 12 ? 0 : month;
  const nextMonthYear = month === 12 ? year + 1 : year;

  return { groups, operasional, produksi, grandTotal, accountSummary, nextMonthIdx, nextMonthYear, prevMonthYear: prev.year };
}
