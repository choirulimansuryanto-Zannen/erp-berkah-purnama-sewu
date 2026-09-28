import "server-only";
import type { CashBook, JournalEntryType, AccountType, NormalBalance } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { signedBalance } from "@/lib/accounting-labels";

// Label constants and isIncomeStatementType/signedBalance live in
// accounting-labels.ts (no "server-only") so client components can import
// them directly — re-exported here too so existing server-side imports of
// "@/lib/accounting" keep working unchanged.
export { CASH_BOOK_LABELS, JOURNAL_ENTRY_TYPE_LABELS, ACCOUNT_TYPE_LABELS, isIncomeStatementType, signedBalance } from "@/lib/accounting-labels";

const INCOME_STATEMENT_TYPES: AccountType[] = [
  "PENDAPATAN",
  "HARGA_POKOK_PENJUALAN",
  "BEBAN_LANGSUNG",
  "BEBAN_OPERASIONAL",
  "BEBAN_NON_OPERASIONAL",
  "PENDAPATAN_NON_OPERASIONAL",
];

/** Voucher-style entry number, e.g. "KASIR-2026-000123" — one sequence per
 * cash book per year, so each book's own paper trail stays contiguous. */
export async function generateEntryNumber(cashBook: CashBook, date: Date): Promise<string> {
  const year = date.getFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
  const count = await prisma.journalEntry.count({
    where: { cashBook, date: { gte: yearStart, lt: yearEnd } },
  });
  return `${cashBook}-${year}-${String(count + 1).padStart(6, "0")}`;
}

export async function getCashBookAccount(cashBook: CashBook) {
  const account = await prisma.chartOfAccount.findFirst({ where: { cashBook } });
  if (!account) throw new Error(`Tidak ada akun Chart of Accounts untuk buku kas ${cashBook}`);
  return account;
}

/**
 * Posts one balanced two-line cash voucher — the ONLY way a JournalEntry is
 * created in this system (see the JournalEntryLine model comment: always
 * exactly two lines). Every entry touches the cash book's own control
 * account on one side, guaranteeing "cash basis" — no entry can ever skip
 * cash entirely, matching how the business actually keeps its six books.
 */
export async function postCashVoucher(params: {
  cashBook: CashBook;
  entryType: JournalEntryType;
  date: Date;
  outletId?: string | null;
  description: string;
  reference?: string | null;
  contraAccountId: string;
  amount: number;
  createdById: string;
}) {
  const { cashBook, entryType, date, outletId, description, reference, contraAccountId, amount, createdById } = params;
  if (amount <= 0) throw new Error("Nominal harus lebih dari 0");

  const cashAccount = await getCashBookAccount(cashBook);
  const entryNumber = await generateEntryNumber(cashBook, date);

  // KAS_MASUK: cash book is debited (cash increases), contra is credited.
  // KAS_KELUAR: contra is debited, cash book is credited (cash decreases).
  // TRANSFER_ANTAR_BUKU: same shape as KAS_KELUAR — cashBook is the SOURCE
  // (credited/decreased), contraAccountId is the DESTINATION cash-book
  // account (debited/increased).
  const cashIsDebit = entryType === "KAS_MASUK";

  return prisma.journalEntry.create({
    data: {
      entryNumber,
      date,
      cashBook,
      entryType,
      outletId: outletId ?? null,
      description,
      reference: reference ?? null,
      createdById,
      lines: {
        create: [
          {
            accountId: cashAccount.id,
            debit: cashIsDebit ? amount : 0,
            credit: cashIsDebit ? 0 : amount,
          },
          {
            accountId: contraAccountId,
            debit: cashIsDebit ? 0 : amount,
            credit: cashIsDebit ? amount : 0,
          },
        ],
      },
    },
    include: { lines: { include: { account: true } } },
  });
}

export type CashFlowLine = {
  activity: CashFlowActivity;
  code: string;
  label: string;
  monthly: number[]; // positive = cash in, negative = cash out, by month
};

/**
 * Direct-method cash flow, Jan-Dec of `year` — grouped by activity, then by
 * the specific contra account within it (so "Operasi" shows exactly which
 * revenue/expense accounts moved cash, not just one lump sum). Transfer
 * Antar Buku entries are excluded entirely: both of their legs are cash
 * accounts, so they have zero net effect on total company cash — only
 * KAS_MASUK/KAS_KELUAR vouchers represent a real inflow or outflow.
 */
export async function getMonthlyCashFlow(year: number): Promise<CashFlowLine[]> {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

  const entries = await prisma.journalEntry.findMany({
    where: { status: "POSTED", entryType: { not: "TRANSFER_ANTAR_BUKU" }, date: { gte: yearStart, lte: yearEnd } },
    select: { date: true, lines: { select: { debit: true, credit: true, account: true } } },
  });

  const byKey = new Map<string, CashFlowLine>();
  for (const e of entries) {
    const cashLine = e.lines.find((l) => l.account.cashBook);
    const contraLine = e.lines.find((l) => !l.account.cashBook);
    if (!cashLine || !contraLine) continue;
    const netCash = Number(cashLine.debit) - Number(cashLine.credit);
    const activity = classifyCashFlowActivity(contraLine.account.type, contraLine.account.code);
    const key = `${activity}__${contraLine.account.code}`;
    const line = byKey.get(key) ?? {
      activity,
      code: contraLine.account.code,
      label: contraLine.account.name,
      monthly: Array.from({ length: 12 }, () => 0),
    };
    line.monthly[e.date.getUTCMonth()] += netCash;
    byKey.set(key, line);
  }

  return [...byKey.values()].sort((a, b) => a.code.localeCompare(b.code));
}

/** Net income per month, Jan-Dec, computed the same way the Laba Rugi
 * report itself does — shared so Perubahan Ekuitas (and anything else that
 * needs "how much profit did each month add to equity") doesn't re-derive
 * it slightly differently. */
export function computeLabaBersihSeries(matrix: MonthlyAccountRow[]): number[] {
  const zero = () => Array.from({ length: 12 }, () => 0);
  const sumType = (type: AccountType) => {
    const out = zero();
    for (const a of matrix.filter((r) => r.type === type)) a.monthly.forEach((v, i) => (out[i] += v));
    return out;
  };
  const pendapatan = sumType("PENDAPATAN");
  const hpp = sumType("HARGA_POKOK_PENJUALAN");
  const bebanLangsung = sumType("BEBAN_LANGSUNG");
  const bebanOperasional = sumType("BEBAN_OPERASIONAL");
  const bebanNonOp = sumType("BEBAN_NON_OPERASIONAL");
  const pendapatanNonOp = sumType("PENDAPATAN_NON_OPERASIONAL");
  return zero().map(
    (_, i) => pendapatan[i] - hpp[i] - bebanLangsung[i] - bebanOperasional[i] + pendapatanNonOp[i] - bebanNonOp[i],
  );
}

export type MonthlyAccountRow = {
  accountId: string;
  code: string;
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
  cashBook: CashBook | null;
  /** Balance brought forward from everything posted before Jan 1 of the
   * selected year — only meaningful for Neraca-type accounts (Aset/
   * Kewajiban/Ekuitas); P&L accounts always start a year at 0. */
  opening: number;
  /** This month's own net movement, Jan(0) through Dec(11) — what a Laba
   * Rugi or Arus Kas column shows, and what a Neraca's cumulative column is
   * built by running-summing on top of `opening`. */
  monthly: number[];
  /** Running balance AT THE END of each month — for Neraca types this is
   * `opening` plus the month's own and every prior month's movement; for
   * P&L types it's year-to-date (resets every Jan 1, same as any income
   * statement). */
  cumulative: number[];
};

/**
 * The one query this whole monthly-comparison report suite (Laba Rugi,
 * Neraca, Arus Kas, Perubahan Ekuitas) is built on: every account's
 * Jan-Dec movement for `year`, plus its balance carried in from all prior
 * years. Two queries total (everything before the year, everything inside
 * it) rather than one per report — each report just reads the fields it
 * needs off the same rows.
 */
export async function getMonthlyAccountMatrix(year: number): Promise<MonthlyAccountRow[]> {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

  const [accounts, openingLines, yearLines] = await Promise.all([
    prisma.chartOfAccount.findMany({ orderBy: { code: "asc" } }),
    prisma.journalEntryLine.findMany({
      where: { journalEntry: { status: "POSTED", date: { lt: yearStart } } },
      select: { accountId: true, debit: true, credit: true },
    }),
    prisma.journalEntryLine.findMany({
      where: { journalEntry: { status: "POSTED", date: { gte: yearStart, lte: yearEnd } } },
      select: { accountId: true, debit: true, credit: true, journalEntry: { select: { date: true } } },
    }),
  ]);

  const openingSums = new Map<string, { debit: number; credit: number }>();
  for (const l of openingLines) {
    const s = openingSums.get(l.accountId) ?? { debit: 0, credit: 0 };
    s.debit += Number(l.debit);
    s.credit += Number(l.credit);
    openingSums.set(l.accountId, s);
  }

  const monthlySums = new Map<string, { debit: number; credit: number }[]>();
  for (const l of yearLines) {
    const month = l.journalEntry.date.getUTCMonth();
    const arr = monthlySums.get(l.accountId) ?? Array.from({ length: 12 }, () => ({ debit: 0, credit: 0 }));
    arr[month].debit += Number(l.debit);
    arr[month].credit += Number(l.credit);
    monthlySums.set(l.accountId, arr);
  }

  const neracaTypes: AccountType[] = ["ASET", "KEWAJIBAN", "EKUITAS"];

  return accounts.map((a) => {
    const os = openingSums.get(a.id) ?? { debit: 0, credit: 0 };
    const opening = neracaTypes.includes(a.type) ? signedBalance(os.debit, os.credit, a.normalBalance) : 0;
    const ms = monthlySums.get(a.id) ?? Array.from({ length: 12 }, () => ({ debit: 0, credit: 0 }));
    const monthly = ms.map((m) => signedBalance(m.debit, m.credit, a.normalBalance));
    let running = opening;
    const cumulative = monthly.map((v) => {
      running += v;
      return running;
    });
    return {
      accountId: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
      normalBalance: a.normalBalance,
      cashBook: a.cashBook,
      opening,
      monthly,
      cumulative,
    };
  });
}

export type CashFlowActivity = "OPERASI" | "INVESTASI" | "PENDANAAN";

/** Which of the three cash-flow activities a cash movement belongs to,
 * based on the TYPE (and, for Aset, the code prefix) of the account on the
 * *other* side of the entry from the cash book — the direct method reads
 * straight off this classification since every entry already touches cash
 * on one leg (see the JournalEntryLine model comment). */
export function classifyCashFlowActivity(contraType: AccountType, contraCode: string): CashFlowActivity {
  if (contraType === "EKUITAS" || contraCode === "2200") return "PENDANAAN"; // Modal / Hutang Bank
  if (contraType === "ASET" && contraCode.startsWith("16")) return "INVESTASI"; // Aset Tetap
  return "OPERASI";
}

export type AccountBalance = {
  accountId: string;
  code: string;
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
  debit: number;
  credit: number;
  balance: number;
};

/** Every leaf account's cumulative debit/credit/balance, POSTED entries
 * only, up to (and including) `asOfDate` — the shared building block behind
 * Trial Balance, Neraca, and Buku Besar's closing figures. */
export async function getAccountBalances(asOfDate?: Date): Promise<AccountBalance[]> {
  const accounts = await prisma.chartOfAccount.findMany({ orderBy: { code: "asc" } });
  const lines = await prisma.journalEntryLine.findMany({
    where: {
      journalEntry: {
        status: "POSTED",
        ...(asOfDate ? { date: { lte: asOfDate } } : {}),
      },
    },
    select: { accountId: true, debit: true, credit: true },
  });
  const sums = new Map<string, { debit: number; credit: number }>();
  for (const l of lines) {
    const s = sums.get(l.accountId) ?? { debit: 0, credit: 0 };
    s.debit += Number(l.debit);
    s.credit += Number(l.credit);
    sums.set(l.accountId, s);
  }
  return accounts.map((a) => {
    const s = sums.get(a.id) ?? { debit: 0, credit: 0 };
    return {
      accountId: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
      normalBalance: a.normalBalance,
      debit: s.debit,
      credit: s.credit,
      balance: signedBalance(s.debit, s.credit, a.normalBalance),
    };
  });
}

/** Income-statement account balances restricted to a date range (Laba Rugi
 * is a period report, unlike Neraca's point-in-time balances) — reuses the
 * same debit/credit bucketing as getAccountBalances but scoped by date. */
export async function getIncomeStatementBalances(dateFrom: Date, dateTo: Date): Promise<AccountBalance[]> {
  const accounts = await prisma.chartOfAccount.findMany({
    where: { type: { in: INCOME_STATEMENT_TYPES } },
    orderBy: { code: "asc" },
  });
  const lines = await prisma.journalEntryLine.findMany({
    where: { journalEntry: { status: "POSTED", date: { gte: dateFrom, lte: dateTo } } },
    select: { accountId: true, debit: true, credit: true },
  });
  const sums = new Map<string, { debit: number; credit: number }>();
  for (const l of lines) {
    const s = sums.get(l.accountId) ?? { debit: 0, credit: 0 };
    s.debit += Number(l.debit);
    s.credit += Number(l.credit);
    sums.set(l.accountId, s);
  }
  return accounts.map((a) => {
    const s = sums.get(a.id) ?? { debit: 0, credit: 0 };
    return {
      accountId: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
      normalBalance: a.normalBalance,
      debit: s.debit,
      credit: s.credit,
      balance: signedBalance(s.debit, s.credit, a.normalBalance),
    };
  });
}
