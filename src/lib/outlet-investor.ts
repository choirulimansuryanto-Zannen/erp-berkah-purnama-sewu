import "server-only";
import { prisma } from "@/lib/prisma";
import { getInventorySheet, getReportSheet } from "@/lib/outlet-report";

// ═══════════════════════════════════════════════════════════════════════
// Outlet-level investor MoU & rolling Profit/Loss ledger — a SEPARATE
// concept from lib/incentive.ts's company-wide Investor/
// SharingProfitDistribution (one pool split by fixed ownership%). Here a
// named investor holds a share (percent of a specific outlet's Laba
// Bersih, or a flat Rupiah amount) in one or more outlets, and the ledger
// below rolls that forward month to month. Confirmed with the business
// 2026-10-12, from this exact recurrence (their own words):
//
//   Share Value = share MoU × laba bersih outlet (summed across every
//     outlet this investor holds a share in)
//   Accum. = Share Value − Transfer/Shared bulan lalu − Adj.; bulan lalu
//     hanya terakumulasi kalau bulan itu tidak profit (i.e. last month's
//     Transfer/Shared only carries into this month's subtraction if last
//     month's own Share Value was <= 0 — a loss/break-even month; a
//     profitable month's Transfer/Shared is NOT carried forward, it's
//     treated as settled)
//   Transfer/Shared = hitungan bersih dari Accum., dipakai sebagai Saldo
//     Share Profit Investor (a direct pass-through of Accum. by default)
//   Nilai negatif tetap ditampilkan pada Transfer/Shared dan tetap
//     diperhitungkan dalam akumulasi bulan berikutnya.
//
// Both Accum. and Transfer/Shared can be manually LOCKED per month
// (OutletInvestorMonthlyLedger.accumOverride/transferSharedOverride) —
// "kosongkan sel untuk memakai nilai hitungan, isi untuk mengunci angka
// lain" in the source spreadsheet. Adj. is always a direct manual entry.
//
// The walk starts at the investor's own createdAt month (their
// openingBalance represents the state just before that month) and runs
// forward to whatever (year, month) is requested — NOT reset at each
// January — so a later year's figures correctly depend on the prior
// year's actual computed state, not a static reseed. Capped at 10 years
// (120 months) as a sanity bound against a runaway walk.
// ═══════════════════════════════════════════════════════════════════════

const MAX_WALK_MONTHS = 120;

export type InvestorMonthState = {
  year: number;
  month: number;
  shareValue: number;
  adj: number;
  accum: number;
  accumIsOverride: boolean;
  transferShared: number;
  transferSharedIsOverride: boolean;
};

function monthIndex(year: number, month: number): number {
  return year * 12 + (month - 1);
}
function fromMonthIndex(idx: number): { year: number; month: number } {
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

type ShareRow = { outletId: string; outletName: string; shareType: "PERSEN" | "NOMINAL"; shareValue: number };

/**
 * Walks an investor's ledger from their tracked start through
 * (throughYear, throughMonth) inclusive, returning every month's state —
 * `labaBersihCache` lets a caller computing several investors over the
 * same outlets/months reuse each (outlet, year, month) Laba Bersih
 * lookup instead of recomputing it per investor.
 */
export async function computeInvestorLedgerThrough(
  investor: { id: string; openingBalance: number; createdAt: Date },
  shares: ShareRow[],
  throughYear: number,
  throughMonth: number,
  labaBersihCache: Map<string, number> = new Map(),
): Promise<InvestorMonthState[]> {
  const startIdx = monthIndex(investor.createdAt.getUTCFullYear(), investor.createdAt.getUTCMonth() + 1);
  const throughIdx = monthIndex(throughYear, throughMonth);
  if (throughIdx < startIdx) return [];
  const clampedStartIdx = Math.max(startIdx, throughIdx - MAX_WALK_MONTHS + 1);

  const ledgerRows = await prisma.outletInvestorMonthlyLedger.findMany({ where: { investorId: investor.id } });
  const ledgerByMonth = new Map(ledgerRows.map((l) => [`${l.year}-${l.month}`, l]));

  async function labaBersih(outletId: string, year: number, month: number): Promise<number> {
    const key = `${outletId}:${year}-${month}`;
    const cached = labaBersihCache.get(key);
    if (cached !== undefined) return cached;
    const inventory = await getInventorySheet(outletId, year, month);
    const report = await getReportSheet(outletId, year, month, inventory);
    labaBersihCache.set(key, report.labaBersih);
    return report.labaBersih;
  }

  const states: InvestorMonthState[] = [];
  let priorTransferShared = investor.openingBalance;
  let priorWasProfit = investor.openingBalance > 0;

  for (let idx = clampedStartIdx; idx <= throughIdx; idx++) {
    const { year, month } = fromMonthIndex(idx);

    let shareValue = 0;
    for (const s of shares) {
      shareValue += s.shareType === "NOMINAL" ? s.shareValue : (s.shareValue / 100) * (await labaBersih(s.outletId, year, month));
    }

    const ledgerRow = ledgerByMonth.get(`${year}-${month}`);
    const adj = Number(ledgerRow?.adj ?? 0);
    const carriedPrior = priorWasProfit ? 0 : priorTransferShared;
    const computedAccum = shareValue - carriedPrior - adj;
    const accumIsOverride = ledgerRow?.accumOverride != null;
    const accum = accumIsOverride ? Number(ledgerRow!.accumOverride) : computedAccum;
    const transferSharedIsOverride = ledgerRow?.transferSharedOverride != null;
    const transferShared = transferSharedIsOverride ? Number(ledgerRow!.transferSharedOverride) : accum;

    states.push({ year, month, shareValue, adj, accum, accumIsOverride, transferShared, transferSharedIsOverride });
    priorTransferShared = transferShared;
    priorWasProfit = shareValue > 0;
  }

  return states;
}

export type InvestorPLRow = {
  investorId: string;
  investorName: string;
  outletNames: string[];
  year: number;
  month: number;
  shareValue: number;
  accum: number;
  accumIsOverride: boolean;
  adj: number;
  transferShared: number;
  transferSharedIsOverride: boolean;
};

/**
 * One row per active investor, each the state of their ledger AS OF
 * (year, month) — "Semua bulan" in the UI means month=12 (year-end
 * cumulative state), a specific month means that month's own state.
 */
export async function getInvestorPLRekap(year: number, month: number): Promise<InvestorPLRow[]> {
  const investors = await prisma.outletInvestorProfile.findMany({
    where: { status: "ACTIVE" },
    include: { shares: { where: { status: "ACTIVE" }, include: { outlet: { select: { name: true } } } } },
    orderBy: { name: "asc" },
  });

  const labaBersihCache = new Map<string, number>();
  const rows: InvestorPLRow[] = [];
  for (const inv of investors) {
    if (inv.shares.length === 0) continue; // no MoU assigned yet — nothing to show
    const shares: ShareRow[] = inv.shares.map((s) => ({
      outletId: s.outletId,
      outletName: s.outlet.name,
      shareType: s.shareType,
      shareValue: Number(s.shareValue),
    }));
    const states = await computeInvestorLedgerThrough(
      { id: inv.id, openingBalance: Number(inv.openingBalance), createdAt: inv.createdAt },
      shares,
      year,
      month,
      labaBersihCache,
    );
    const last = states[states.length - 1];
    if (!last) continue; // investor's tracked history hasn't started yet as of this period
    rows.push({
      investorId: inv.id,
      investorName: inv.name,
      outletNames: [...new Set(shares.map((s) => s.outletName))],
      year: last.year,
      month: last.month,
      shareValue: last.shareValue,
      accum: last.accum,
      accumIsOverride: last.accumIsOverride,
      adj: last.adj,
      transferShared: last.transferShared,
      transferSharedIsOverride: last.transferSharedIsOverride,
    });
  }
  return rows;
}
