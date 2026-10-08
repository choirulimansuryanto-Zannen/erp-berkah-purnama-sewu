import { prisma } from "@/lib/prisma";

// Fixed Asset register — straight-line depreciation computed LIVE from
// (depreciableBase, usefulLifeMonths, acquisitionDate) for whatever
// year/month is selected, rather than stored as a frozen snapshot. This
// means the schedule keeps accruing correctly every month going forward —
// same convention as every other FA Company report (Neraca, Laba Rugi, …).
//
// Column meanings (matching the business's own register):
//   Acquisition Amount — the full purchase cost.
//   PT (depreciableBase) — the portion of that cost actually depreciated;
//     can be less than Acquisition Amount (e.g. land bundled into a
//     building purchase is never depreciated). This is a FIXED reference
//     value, the same every period — by construction it always equals
//     Accumulated Depreciation + Economic Value for any period shown.
//   2026 / monthly columns — this year's depreciation, Jan..selected month.
//   Accum Depreciation Expense — total accumulated since acquisition,
//     through the selected month (prior years + this year to date).
//   Economic Value — net book value: depreciableBase − accumulated.

export const FIXED_ASSET_CATEGORY_LABELS: Record<string, string> = {
  BANGUNAN_KANTOR: "BANGUNAN KANTOR",
  PERALATAN_KANTOR: "PERALATAN KANTOR",
  BANGUNAN_PABRIK: "BANGUNAN PABRIK",
  PERALATAN_PABRIK: "PERALATAN PABRIK",
  KENDARAAN: "KENDARAAN PABRIK",
};
export const FIXED_ASSET_CATEGORY_ORDER = ["BANGUNAN_KANTOR", "PERALATAN_KANTOR", "BANGUNAN_PABRIK", "PERALATAN_PABRIK", "KENDARAAN"] as const;

export type FixedAssetScheduleRow = {
  id: string;
  no: number | null;
  description: string;
  acquisitionAmount: number;
  depreciableBase: number; // "PT"
  yearToDateTotal: number; // this year's Jan..selectedMonth total — the "2026" column
  months: number[]; // one entry per month, Jan..selectedMonth
  accumulatedDepreciation: number; // through selected month, since acquisition
  economicValue: number; // net book value as of selected month
  remark: string | null;
  fullyDepreciated: boolean;
};

export type FixedAssetCategoryGroup = {
  category: string;
  label: string;
  rows: FixedAssetScheduleRow[];
  totals: Omit<FixedAssetScheduleRow, "id" | "no" | "description" | "remark" | "fullyDepreciated">;
};

function monthIndex(year: number, month1to12: number): number {
  return year * 12 + (month1to12 - 1);
}

/** Whole calendar months of depreciation recognized from acquisition (inclusive of its own month) through the given year/month (inclusive), capped at the asset's useful life. */
function monthsElapsedThrough(acquisitionDate: Date, year: number, month1to12: number, usefulLifeMonths: number): number {
  const acqIdx = monthIndex(acquisitionDate.getUTCFullYear(), acquisitionDate.getUTCMonth() + 1);
  const refIdx = monthIndex(year, month1to12);
  if (refIdx < acqIdx) return 0;
  return Math.max(0, Math.min(usefulLifeMonths, refIdx - acqIdx + 1));
}

function sumRows(rows: FixedAssetScheduleRow[], monthCount: number) {
  const totals = {
    acquisitionAmount: 0,
    depreciableBase: 0,
    yearToDateTotal: 0,
    months: Array.from({ length: monthCount }, () => 0),
    accumulatedDepreciation: 0,
    economicValue: 0,
  };
  for (const r of rows) {
    totals.acquisitionAmount += r.acquisitionAmount;
    totals.depreciableBase += r.depreciableBase;
    totals.yearToDateTotal += r.yearToDateTotal;
    totals.accumulatedDepreciation += r.accumulatedDepreciation;
    totals.economicValue += r.economicValue;
    for (let i = 0; i < monthCount; i++) totals.months[i] += r.months[i] ?? 0;
  }
  return totals;
}

export async function getFixedAssetSchedule(year: number, month: number) {
  const assets = await prisma.fixedAsset.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ category: "asc" }, { no: "asc" }],
  });

  const allRows: (FixedAssetScheduleRow & { category: string })[] = assets.map((a) => {
    const depreciableBase = Number(a.depreciableBase);
    const monthly = a.usefulLifeMonths > 0 ? depreciableBase / a.usefulLifeMonths : 0;

    const monthsElapsedPriorYear = monthsElapsedThrough(a.acquisitionDate, year - 1, 12, a.usefulLifeMonths);
    const priorAccumulated = monthly * monthsElapsedPriorYear;

    const months: number[] = [];
    let cumThisYear = 0;
    for (let m = 1; m <= month; m++) {
      const elapsedThroughM = monthsElapsedThrough(a.acquisitionDate, year, m, a.usefulLifeMonths);
      const cumThroughM = elapsedThroughM * monthly;
      const thisMonth = Math.max(0, cumThroughM - priorAccumulated - cumThisYear);
      months.push(thisMonth);
      cumThisYear += thisMonth;
    }

    const accumulatedDepreciation = Math.min(depreciableBase, priorAccumulated + cumThisYear);
    const economicValue = Math.max(0, depreciableBase - accumulatedDepreciation);

    return {
      id: a.id,
      no: a.no,
      category: a.category,
      description: a.description,
      acquisitionAmount: Number(a.acquisitionAmount),
      depreciableBase,
      yearToDateTotal: cumThisYear,
      months,
      accumulatedDepreciation,
      economicValue,
      remark: a.remark,
      fullyDepreciated: accumulatedDepreciation >= depreciableBase - 0.01,
    };
  });

  const groups: FixedAssetCategoryGroup[] = FIXED_ASSET_CATEGORY_ORDER.filter((cat) => allRows.some((r) => r.category === cat)).map((cat) => {
    const rows = allRows.filter((r) => r.category === cat);
    return { category: cat, label: FIXED_ASSET_CATEGORY_LABELS[cat], rows, totals: sumRows(rows, month) };
  });

  const grandTotal = sumRows(allRows, month);

  return { groups, grandTotal, monthCount: month };
}
