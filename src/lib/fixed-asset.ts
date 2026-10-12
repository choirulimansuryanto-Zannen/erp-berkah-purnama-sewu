import { prisma } from "@/lib/prisma";

// Fixed Asset register — straight-line depreciation computed LIVE from
// (depreciableBase, usefulLifeMonths, acquisitionDate) for whatever
// year is selected, rather than stored as a frozen snapshot. This means
// the schedule keeps accruing correctly every month going forward — same
// convention as every other FA Company report (Neraca, Laba Rugi, …).
//
// The monthly grid ALWAYS shows all 12 months of the selected year —
// depreciation is a deterministic schedule (known asset, known useful
// life, known acquisition date), not data that needs to be entered each
// month, so November/December's columns exist and are computed in
// October just as readily as January's. `asOfMonth` only controls where
// the YTD/Accumulated/Economic-Value *summary* figures are cut off
// (defaults to "today" — see getFixedAssetSchedule's caller in
// page.tsx): current year → up to the current month, past year → the
// full 12 months, future year → 0 (nothing in it has happened yet).
// Months after asOfMonth still appear in the grid (so the full year's
// schedule is visible at a glance) but are flagged `isProjected` so the
// UI can style them as forecast rather than actual.
//
// Column meanings (matching the business's own register):
//   Acquisition Amount — the full purchase cost.
//   PT (depreciableBase) — the portion of that cost actually depreciated;
//     can be less than Acquisition Amount (e.g. land bundled into a
//     building purchase is never depreciated). This is a FIXED reference
//     value, the same every period — by construction it always equals
//     Accumulated Depreciation + Economic Value for any period shown.
//   2026 / monthly columns — this year's depreciation, Jan..Dec.
//   Accum Depreciation Expense — total accumulated since acquisition,
//     through asOfMonth (prior years + this year to date).
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
  yearToDateTotal: number; // this year's Jan..asOfMonth total — the "2026" column
  months: number[]; // always 12 entries, Jan..Dec
  monthsProjected: boolean[]; // true for months after asOfMonth — forecast, not yet elapsed
  accumulatedDepreciation: number; // through asOfMonth, since acquisition
  economicValue: number; // net book value as of asOfMonth
  remark: string | null;
  fullyDepreciated: boolean;
};

export type FixedAssetCategoryGroup = {
  category: string;
  label: string;
  rows: FixedAssetScheduleRow[];
  totals: Omit<FixedAssetScheduleRow, "id" | "no" | "description" | "remark" | "fullyDepreciated" | "monthsProjected">;
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

function sumRows(rows: FixedAssetScheduleRow[]) {
  const totals = {
    acquisitionAmount: 0,
    depreciableBase: 0,
    yearToDateTotal: 0,
    months: Array.from({ length: 12 }, () => 0),
    accumulatedDepreciation: 0,
    economicValue: 0,
  };
  for (const r of rows) {
    totals.acquisitionAmount += r.acquisitionAmount;
    totals.depreciableBase += r.depreciableBase;
    totals.yearToDateTotal += r.yearToDateTotal;
    totals.accumulatedDepreciation += r.accumulatedDepreciation;
    totals.economicValue += r.economicValue;
    for (let i = 0; i < 12; i++) totals.months[i] += r.months[i] ?? 0;
  }
  return totals;
}

/**
 * The years worth showing in the Fixed Asset year picker — from the
 * earliest asset's acquisition year through the latest asset's
 * fully-depreciated year (acquisition + useful life), padded a couple
 * years on each side so a newly-registered asset still has room to
 * browse into the future before its schedule actually needs it, and
 * historical corrections just before the earliest acquisition stay
 * reachable too. This is computed from real data (not a fixed ±N-year
 * window) so it grows automatically as assets are added — adding a
 * 10-year asset next year, or backfilling one acquired years ago, just
 * works without anyone needing to widen a hardcoded range again.
 * Falls back to a plain window around today when there are no assets yet.
 */
export async function getFixedAssetYearRange(): Promise<{ minYear: number; maxYear: number }> {
  const assets = await prisma.fixedAsset.findMany({
    where: { status: "ACTIVE" },
    select: { acquisitionDate: true, usefulLifeMonths: true },
  });
  const thisYear = new Date().getFullYear();
  if (assets.length === 0) return { minYear: thisYear - 2, maxYear: thisYear + 2 };

  let minYear = thisYear;
  let maxYear = thisYear;
  for (const a of assets) {
    const acqYear = a.acquisitionDate.getUTCFullYear();
    const endYear = acqYear + Math.ceil(a.usefulLifeMonths / 12);
    if (acqYear < minYear) minYear = acqYear;
    if (endYear > maxYear) maxYear = endYear;
  }
  // The future end is capped — one asset with an unusually long useful
  // life (decades) shouldn't blow the picker out to a 50-year dropdown
  // nobody will ever scroll through. thisYear+10 comfortably covers any
  // normal asset's remaining schedule for day-to-day monitoring; an asset
  // whose depreciation genuinely runs past that is still computed
  // correctly, just not pre-listed that far out in the picker.
  return { minYear: minYear - 2, maxYear: Math.min(maxYear + 3, thisYear + 10) };
}

/**
 * `asOfMonth` (1-12, or 0) cuts off the YTD/Accumulated/Economic-Value
 * summary figures — pass the current month for the current year, 12 for
 * a past year, 0 for a future year (see page.tsx). The monthly grid
 * itself always covers the full 12 months of `year`, independent of
 * asOfMonth, so future months are never missing a column.
 */
export async function getFixedAssetSchedule(year: number, asOfMonth: number) {
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
    const monthsProjected: boolean[] = [];
    let cumRunning = 0;
    let cumThisYear = 0;
    for (let m = 1; m <= 12; m++) {
      const elapsedThroughM = monthsElapsedThrough(a.acquisitionDate, year, m, a.usefulLifeMonths);
      const cumThroughM = elapsedThroughM * monthly;
      const thisMonth = Math.max(0, cumThroughM - priorAccumulated - cumRunning);
      months.push(thisMonth);
      monthsProjected.push(m > asOfMonth);
      cumRunning += thisMonth;
      if (m <= asOfMonth) cumThisYear += thisMonth;
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
      monthsProjected,
      accumulatedDepreciation,
      economicValue,
      remark: a.remark,
      fullyDepreciated: accumulatedDepreciation >= depreciableBase - 0.01,
    };
  });

  const groups: FixedAssetCategoryGroup[] = FIXED_ASSET_CATEGORY_ORDER.filter((cat) => allRows.some((r) => r.category === cat)).map((cat) => {
    const rows = allRows.filter((r) => r.category === cat);
    return { category: cat, label: FIXED_ASSET_CATEGORY_LABELS[cat], rows, totals: sumRows(rows) };
  });

  const grandTotal = sumRows(allRows);

  return { groups, grandTotal, monthCount: 12, asOfMonth };
}
