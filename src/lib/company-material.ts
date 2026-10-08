import { prisma } from "@/lib/prisma";

// Company-wide (warehouse-level) SKU stock-opname — "Riwayat Persediaan
// Akhir" detail table on /finance/persediaan. Nilai Akhir and Total are
// DERIVED here, never stored, so they can't drift from their inputs:
//   Nilai Akhir Persediaan = qtyOpname × costPerUnit + adjustmentNilai
//   Total Qty              = qtyOpname − fakturOutletQty
//   Total Nominal          = Nilai Akhir Persediaan − fakturOutletNominal
// (the Faktur Outlet columns are goods already invoiced OUT to outlets
// effective the 1st of the following month, so Total = what's left after
// that shipment — confirmed by reconciling against the source: Daging's
// 95,809,000 saldo − 47,261,500 faktur = 48,547,500, exactly its Total).

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
  qtyOpname: number;
  costPerUnit: number;
  nilaiAkhir: number;
  adjustmentNilai: number;
  fakturOutletQty: number;
  fakturOutletNominal: number;
  totalQty: number;
  totalNominal: number;
};

export type CompanyMaterialCategoryGroup = {
  category: string;
  label: string;
  rows: CompanyMaterialRow[];
  totalNilaiAkhir: number;
  totalFakturNominal: number;
  totalNominal: number;
};

function sumGroup(rows: CompanyMaterialRow[]) {
  return {
    totalNilaiAkhir: rows.reduce((s, r) => s + r.nilaiAkhir, 0),
    totalFakturNominal: rows.reduce((s, r) => s + r.fakturOutletNominal, 0),
    totalNominal: rows.reduce((s, r) => s + r.totalNominal, 0),
  };
}

export async function getCompanyMaterialSchedule(year: number, month: number) {
  const materials = await prisma.companyMaterial.findMany({
    where: { status: "ACTIVE" },
    include: { closingBalances: { where: { year, month } } },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });

  const allRows: (CompanyMaterialRow & { category: string })[] = materials.map((m) => {
    const cb = m.closingBalances[0];
    const qtyOpname = Number(cb?.qtyOpname ?? 0);
    const costPerUnit = Number(cb?.costPerUnit ?? 0);
    const adjustmentNilai = Number(cb?.adjustmentNilai ?? 0);
    const fakturOutletQty = Number(cb?.fakturOutletQty ?? 0);
    const fakturOutletNominal = Number(cb?.fakturOutletNominal ?? 0);
    const nilaiAkhir = qtyOpname * costPerUnit + adjustmentNilai;
    return {
      id: m.id,
      code: m.code,
      name: m.name,
      unit: m.unit,
      category: m.category,
      qtyOpname,
      costPerUnit,
      nilaiAkhir,
      adjustmentNilai,
      fakturOutletQty,
      fakturOutletNominal,
      totalQty: qtyOpname - fakturOutletQty,
      totalNominal: nilaiAkhir - fakturOutletNominal,
    };
  });

  const groups: CompanyMaterialCategoryGroup[] = COMPANY_MATERIAL_CATEGORY_ORDER.filter((cat) => allRows.some((r) => r.category === cat)).map((cat) => {
    const rows = allRows.filter((r) => r.category === cat);
    return { category: cat, label: COMPANY_MATERIAL_CATEGORY_LABELS[cat], rows, ...sumGroup(rows) };
  });

  const operasionalRows = allRows.filter((r) => OPERASIONAL_CATEGORIES.has(r.category));
  const produksiRows = allRows.filter((r) => PRODUKSI_CATEGORIES.has(r.category));
  const operasional = sumGroup(operasionalRows);
  const produksi = sumGroup(produksiRows);
  const grandTotal = {
    totalNilaiAkhir: operasional.totalNilaiAkhir + produksi.totalNilaiAkhir,
    totalFakturNominal: operasional.totalFakturNominal + produksi.totalFakturNominal,
    totalNominal: operasional.totalNominal + produksi.totalNominal,
  };

  // Next-month label for the "Faktur 01 <bulan depan> Outlet" column header.
  const nextMonthIdx = month === 12 ? 0 : month;
  const nextMonthYear = month === 12 ? year + 1 : year;

  return { groups, operasional, produksi, grandTotal, nextMonthIdx, nextMonthYear };
}
