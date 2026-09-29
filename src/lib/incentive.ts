import "server-only";
import { prisma } from "@/lib/prisma";
import { getMonthlyAccountMatrix, getMonthlyHppReport, computeLabaBersihSeries, accountSubtree, typeNaturalValue, REVENUE_GROUPS } from "@/lib/accounting";
import type { IncentiveBasis, IncentiveRuleType, IncentiveScope } from "@prisma/client";

export const INCENTIVE_TYPE_LABELS: Record<IncentiveRuleType, string> = {
  PRAMU: "Insentive Pramuniaga",
  SPV: "Insentive SPV",
  PENGELOLA: "Insentive Pengelola",
  OFFICER_SALES: "Insentive Officer Sales",
  HEAD_SALES: "Insentive Head Sales",
  OFFICER_MARKETING: "Insentive Officer Marketing",
  HEAD_MARKETING: "Insentive Head Marketing",
  HEAD_FA: "Insentive Head FA",
  HEAD_OPERASIONAL: "Insentive Head Operasional",
  MANAGEMENT: "Insentive Management",
};

export const INCENTIVE_SCOPE_LABELS: Record<IncentiveScope, string> = {
  OUTLET: "Per Outlet",
  REGION: "Per Wilayah",
  COMPANY: "Perusahaan",
};

export const INCENTIVE_BASIS_LABELS: Record<IncentiveBasis, string> = {
  PERSEN_OMSET: "% Omset",
  PERSEN_LABA_KOTOR: "% Laba Kotor",
  PERSEN_LABA_BERSIH: "% Laba Bersih",
  NOMINAL_TETAP: "Nominal Tetap",
};

/** Company-wide Omset/Laba Kotor/Laba Bersih for exactly one month — the
 * base figures every COMPANY-scoped incentive rule (and Sharing Profit)
 * is computed from. Built from the same monthly matrix/HPP engine every FA
 * report page reads, just picking out the one month index needed. */
export async function getCompanyMonthlyFigures(year: number, month: number) {
  const monthIndex = month - 1;
  const [matrix, hppReport] = await Promise.all([getMonthlyAccountMatrix(year), getMonthlyHppReport(year)]);
  const omset = REVENUE_GROUPS.reduce((sum, g) => {
    const accounts = accountSubtree(matrix, g.code).filter((a) => a.code !== g.code);
    return sum + accounts.reduce((s, a) => s + typeNaturalValue(a.monthly[monthIndex], a.type, a.normalBalance), 0);
  }, 0);
  const hpp = hppReport.cashBasisHpp[monthIndex];
  const labaKotor = omset - hpp;
  const labaBersih = computeLabaBersihSeries(matrix, hppReport.cashBasisHpp)[monthIndex];
  return { omset, labaKotor, labaBersih };
}

function monthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start, end };
}

export async function getOutletMonthlyOmset(outletId: string, year: number, month: number): Promise<number> {
  const { start, end } = monthRange(year, month);
  const agg = await prisma.dailyReport.aggregate({
    where: { outletId, status: "APPROVED", date: { gte: start, lte: end } },
    _sum: { omset: true },
  });
  return Number(agg._sum.omset ?? 0);
}

export async function getRegionMonthlyOmset(regionId: string, year: number, month: number): Promise<number> {
  const { start, end } = monthRange(year, month);
  const agg = await prisma.dailyReport.aggregate({
    where: { status: "APPROVED", date: { gte: start, lte: end }, outlet: { regionId } },
    _sum: { omset: true },
  });
  return Number(agg._sum.omset ?? 0);
}

/** Barang Rusak (approved StockAdjustment, valued at Product.cost) +
 * Barang Reject + Barang Selisih (both already tracked per-day on
 * InventoryRecord) for one outlet/month — the exact three lines the
 * Adjustment Sheet needs, and also this outlet's "cost of shrinkage" for
 * the Pengelola gross-margin proxy below. */
export async function getOutletAdjustmentNominal(outletId: string, year: number, month: number) {
  const { start, end } = monthRange(year, month);
  const [adjustments, records] = await Promise.all([
    prisma.stockAdjustment.findMany({
      where: { outletId, status: "APPROVED", createdAt: { gte: start, lte: end } },
      include: { product: { select: { cost: true } } },
    }),
    prisma.inventoryRecord.findMany({
      where: { outletId, date: { gte: start, lte: end } },
      include: { product: { select: { cost: true } } },
    }),
  ]);
  const rusak = adjustments.reduce((s, a) => s + Math.abs(a.qtyChange) * Number(a.product.cost), 0);
  const reject = records.reduce((s, r) => s + r.rejected * Number(r.product.cost), 0);
  const selisih = records.reduce((s, r) => s + Math.abs(r.variance) * Number(r.product.cost), 0);
  return { rusak, reject, selisih, total: rusak + reject + selisih };
}

export async function getOutletPurchaseTotal(outletId: string, year: number, month: number): Promise<number> {
  const { start, end } = monthRange(year, month);
  const agg = await prisma.outletPurchase.aggregate({
    where: { outletId, date: { gte: start, lte: end } },
    _sum: { amount: true },
  });
  return Number(agg._sum.amount ?? 0);
}

/** Every ACTIVE outlet's Omset/Purchase/Adjustment figures for one month,
 * in four queries total regardless of outlet count — what
 * runIncentiveCalculation actually uses (rather than the single-outlet
 * helpers above, looped) so a 60+-outlet company recalculates in roughly
 * constant time instead of scaling with outlet count. */
async function getAllOutletFiguresForMonth(year: number, month: number) {
  const { start, end } = monthRange(year, month);
  const [omsetRows, purchaseRows, adjustments, records] = await Promise.all([
    prisma.dailyReport.groupBy({
      by: ["outletId"],
      where: { status: "APPROVED", date: { gte: start, lte: end } },
      _sum: { omset: true },
    }),
    prisma.outletPurchase.groupBy({
      by: ["outletId"],
      where: { date: { gte: start, lte: end } },
      _sum: { amount: true },
    }),
    prisma.stockAdjustment.findMany({
      where: { status: "APPROVED", createdAt: { gte: start, lte: end } },
      select: { outletId: true, qtyChange: true, product: { select: { cost: true } } },
    }),
    prisma.inventoryRecord.findMany({
      where: { date: { gte: start, lte: end } },
      select: { outletId: true, rejected: true, variance: true, product: { select: { cost: true } } },
    }),
  ]);

  const omsetByOutlet = new Map(omsetRows.map((r) => [r.outletId, Number(r._sum.omset ?? 0)]));
  const purchaseByOutlet = new Map(purchaseRows.map((r) => [r.outletId, Number(r._sum.amount ?? 0)]));
  const shrinkageByOutlet = new Map<string, number>();
  for (const a of adjustments) {
    shrinkageByOutlet.set(a.outletId, (shrinkageByOutlet.get(a.outletId) ?? 0) + Math.abs(a.qtyChange) * Number(a.product.cost));
  }
  for (const r of records) {
    const cost = Number(r.product.cost);
    shrinkageByOutlet.set(r.outletId, (shrinkageByOutlet.get(r.outletId) ?? 0) + r.rejected * cost + Math.abs(r.variance) * cost);
  }

  return {
    omset: (outletId: string) => omsetByOutlet.get(outletId) ?? 0,
    grossMarginProxy: (outletId: string) =>
      (omsetByOutlet.get(outletId) ?? 0) - (purchaseByOutlet.get(outletId) ?? 0) - (shrinkageByOutlet.get(outletId) ?? 0),
  };
}

/** Outlet-level gross-margin proxy for the Pengelola incentive: Omset less
 * this month's local purchases and shrinkage (rusak/reject/selisih). FA
 * Company's own Laba Kotor is a company-wide cash-basis figure (Total
 * Penjualan - HPP) with no per-outlet breakdown, so this is a deliberate
 * approximation, not the same figure — documented here and wherever it's
 * displayed so it's never mistaken for a company-book number. */
export async function getOutletGrossMarginProxy(outletId: string, year: number, month: number): Promise<number> {
  const [omset, purchases, adjustments] = await Promise.all([
    getOutletMonthlyOmset(outletId, year, month),
    getOutletPurchaseTotal(outletId, year, month),
    getOutletAdjustmentNominal(outletId, year, month),
  ]);
  return omset - purchases - adjustments.total;
}

function computeAmount(basis: IncentiveBasis, rate: number, baseAmount: number): number {
  if (basis === "NOMINAL_TETAP") return rate;
  return (baseAmount * rate) / 100;
}

/**
 * Computes and upserts every IncentiveCalculation row for one month:
 * PRAMU/PENGELOLA per active outlet, SPV per region (that has one
 * assigned), everything else once company-wide. Re-running for the same
 * month replaces its rows (no formal period-close concept yet, same as
 * JournalEntry/InventoryClosingBalance).
 */
export async function runIncentiveCalculation(year: number, month: number, calculatedById: string) {
  const rules = await prisma.incentiveRule.findMany({ where: { status: "ACTIVE" } });
  const ruleByType = new Map(rules.map((r) => [r.type, r]));
  const company = await getCompanyMonthlyFigures(year, month);

  const writes: {
    type: IncentiveRuleType;
    scope: IncentiveScope;
    outletId: string | null;
    regionId: string | null;
    ruleId: string;
    basis: IncentiveBasis;
    rateSnapshot: number;
    baseAmount: number;
    amount: number;
  }[] = [];

  function baseFor(basis: IncentiveBasis): number {
    if (basis === "PERSEN_LABA_KOTOR") return company.labaKotor;
    if (basis === "PERSEN_LABA_BERSIH") return company.labaBersih;
    if (basis === "PERSEN_OMSET") return company.omset;
    return 1;
  }

  const outlets = await prisma.outlet.findMany({ where: { status: "ACTIVE" }, select: { id: true, regionId: true } });
  const regions = await prisma.region.findMany({ where: { spvId: { not: null } }, select: { id: true } });
  // One pass over every outlet's Omset/Purchase/Adjustment data for the
  // month — O(1) queries regardless of outlet count, instead of looping
  // per-outlet awaits (which scaled linearly and was the actual bottleneck
  // for a 60+-outlet company).
  const outletFigures = await getAllOutletFiguresForMonth(year, month);

  const pramuRule = ruleByType.get("PRAMU");
  const pengelolaRule = ruleByType.get("PENGELOLA");
  if (pramuRule || pengelolaRule) {
    for (const o of outlets) {
      const omset = outletFigures.omset(o.id);
      if (pramuRule) {
        writes.push({
          type: "PRAMU", scope: "OUTLET", outletId: o.id, regionId: null, ruleId: pramuRule.id,
          basis: pramuRule.basis, rateSnapshot: Number(pramuRule.rate), baseAmount: omset,
          amount: computeAmount(pramuRule.basis, Number(pramuRule.rate), omset),
        });
      }
      if (pengelolaRule) {
        const base = pengelolaRule.basis === "PERSEN_LABA_KOTOR" ? outletFigures.grossMarginProxy(o.id) : omset;
        writes.push({
          type: "PENGELOLA", scope: "OUTLET", outletId: o.id, regionId: null, ruleId: pengelolaRule.id,
          basis: pengelolaRule.basis, rateSnapshot: Number(pengelolaRule.rate), baseAmount: base,
          amount: computeAmount(pengelolaRule.basis, Number(pengelolaRule.rate), base),
        });
      }
    }
  }

  const spvRule = ruleByType.get("SPV");
  if (spvRule) {
    const regionOmset = new Map<string, number>();
    if (spvRule.basis === "PERSEN_OMSET") {
      for (const o of outlets) regionOmset.set(o.regionId, (regionOmset.get(o.regionId) ?? 0) + outletFigures.omset(o.id));
    }
    for (const r of regions) {
      const base = spvRule.basis === "PERSEN_OMSET" ? (regionOmset.get(r.id) ?? 0) : baseFor(spvRule.basis);
      writes.push({
        type: "SPV", scope: "REGION", outletId: null, regionId: r.id, ruleId: spvRule.id,
        basis: spvRule.basis, rateSnapshot: Number(spvRule.rate), baseAmount: base,
        amount: computeAmount(spvRule.basis, Number(spvRule.rate), base),
      });
    }
  }
  const COMPANY_TYPES: IncentiveRuleType[] = [
    "OFFICER_SALES", "HEAD_SALES", "OFFICER_MARKETING", "HEAD_MARKETING", "HEAD_FA", "HEAD_OPERASIONAL", "MANAGEMENT",
  ];
  for (const type of COMPANY_TYPES) {
    const rule = ruleByType.get(type);
    if (!rule) continue;
    const base = baseFor(rule.basis);
    writes.push({
      type, scope: "COMPANY", outletId: null, regionId: null, ruleId: rule.id,
      basis: rule.basis, rateSnapshot: Number(rule.rate), baseAmount: base,
      amount: computeAmount(rule.basis, Number(rule.rate), base),
    });
  }

  // Not a plain upsert-by-compound-unique: outletId/regionId are nullable,
  // and Postgres never treats two NULLs as equal for a unique constraint
  // (so @@unique([...outletId, regionId]) can't actually stop duplicate
  // COMPANY-scope rows, where both are null) — Prisma's generated upsert
  // type for this compound key correctly refuses null here for exactly
  // that reason. One findMany (a plain filter, where null IS handled as IS
  // NULL) up front + a single createMany/parallel-updates pass sidesteps
  // the whole issue without falling back to per-row round trips.
  const existingRows = await prisma.incentiveCalculation.findMany({
    where: { year, month },
    select: { id: true, type: true, outletId: true, regionId: true },
  });
  const rowKey = (type: string, outletId: string | null, regionId: string | null) => `${type}|${outletId}|${regionId}`;
  const existingIdByKey = new Map(existingRows.map((r) => [rowKey(r.type, r.outletId, r.regionId), r.id]));

  const toCreate = writes.filter((w) => !existingIdByKey.has(rowKey(w.type, w.outletId, w.regionId)));
  const toUpdate = writes.filter((w) => existingIdByKey.has(rowKey(w.type, w.outletId, w.regionId)));

  await Promise.all([
    toCreate.length > 0
      ? prisma.incentiveCalculation.createMany({ data: toCreate.map((w) => ({ year, month, calculatedById, ...w })) })
      : Promise.resolve(),
    ...toUpdate.map((w) =>
      prisma.incentiveCalculation.update({
        where: { id: existingIdByKey.get(rowKey(w.type, w.outletId, w.regionId))! },
        data: { rateSnapshot: w.rateSnapshot, baseAmount: w.baseAmount, amount: w.amount, calculatedById, calculatedAt: new Date() },
      }),
    ),
  ]);

  return writes.length;
}

/** Splits the investor pool (poolRate% of Laba Bersih) across every active
 * Investor by their ownershipPct. Re-running for the same month replaces
 * its rows. */
export async function runSharingProfitCalculation(year: number, month: number, calculatedById: string) {
  const [rule, investors, company] = await Promise.all([
    prisma.sharingProfitRule.findFirst(),
    prisma.investor.findMany({ where: { status: "ACTIVE" } }),
    getCompanyMonthlyFigures(year, month),
  ]);
  const poolRate = Number(rule?.rate ?? 0);
  const poolAmount = (company.labaBersih * poolRate) / 100;

  for (const investor of investors) {
    const ownershipSnapshot = Number(investor.ownershipPct);
    const amount = (poolAmount * ownershipSnapshot) / 100;
    await prisma.sharingProfitDistribution.upsert({
      where: { year_month_investorId: { year, month, investorId: investor.id } },
      create: {
        year, month, investorId: investor.id, labaBersih: company.labaBersih, poolRate, poolAmount,
        ownershipSnapshot, amount, calculatedById,
      },
      update: { labaBersih: company.labaBersih, poolRate, poolAmount, ownershipSnapshot, amount, calculatedById, calculatedAt: new Date() },
    });
  }

  return investors.length;
}
