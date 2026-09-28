import "server-only";
import type { CashBook, JournalEntryType, AccountType, NormalBalance, InventoryCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { signedBalance, typeNaturalValue } from "@/lib/accounting-labels";

// Label constants and isIncomeStatementType/signedBalance live in
// accounting-labels.ts (no "server-only") so client components can import
// them directly — re-exported here too so existing server-side imports of
// "@/lib/accounting" keep working unchanged.
export {
  CASH_BOOK_LABELS,
  JOURNAL_ENTRY_TYPE_LABELS,
  ACCOUNT_TYPE_LABELS,
  isIncomeStatementType,
  signedBalance,
  typeNaturalValue,
  TYPE_NATURAL_BALANCE,
} from "@/lib/accounting-labels";

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
  // status: "ACTIVE" matters here specifically — a chart-of-accounts
  // restructure deactivates the old control account for a book and creates
  // a new one at a different code, and both briefly carry the same
  // CashBook tag (nothing in the schema enforces uniqueness on it). Without
  // this filter, findFirst()'s pick between the two would be arbitrary.
  const account = await prisma.chartOfAccount.findFirst({ where: { cashBook, status: "ACTIVE" } });
  if (!account) throw new Error(`Tidak ada akun Chart of Accounts aktif untuk buku kas ${cashBook}`);
  return account;
}

/** Entry number for a non-cash adjusting entry, e.g. "JU-2026-000012" — one
 * sequence per year across all Jurnal Penyesuaian, since (unlike the six
 * cash books) there is only one "book" of these. */
export async function generateAdjustingEntryNumber(date: Date): Promise<string> {
  const year = date.getFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
  const count = await prisma.journalEntry.count({
    where: { entryType: "JURNAL_PENYESUAIAN", date: { gte: yearStart, lt: yearEnd } },
  });
  return `JU-${year}-${String(count + 1).padStart(6, "0")}`;
}

/**
 * Posts a non-cash adjusting entry — depresiasi, akrual beban/pendapatan,
 * amortisasi biaya dibayar-di-muka, koreksi, dan sejenisnya. This is the
 * one JournalEntry shape that does NOT touch a cash book on either leg (see
 * the JournalEntry.cashBook comment) — both accounts must therefore be
 * non-cash-book accounts. Anything that moves real cash belongs in
 * postCashVoucher instead, keeping the six books' own cash trail exact.
 */
export async function postAdjustingEntry(params: {
  date: Date;
  description: string;
  reference?: string | null;
  debitAccountId: string;
  creditAccountId: string;
  amount: number;
  createdById: string;
}) {
  const { date, description, reference, debitAccountId, creditAccountId, amount, createdById } = params;
  if (amount <= 0) throw new Error("Nominal harus lebih dari 0");
  if (debitAccountId === creditAccountId) throw new Error("Akun debit dan kredit tidak boleh sama");

  const [debitAccount, creditAccount] = await Promise.all([
    prisma.chartOfAccount.findUnique({ where: { id: debitAccountId } }),
    prisma.chartOfAccount.findUnique({ where: { id: creditAccountId } }),
  ]);
  if (!debitAccount || !creditAccount) throw new Error("Akun tidak ditemukan");
  if (debitAccount.cashBook || creditAccount.cashBook) {
    throw new Error("Jurnal Penyesuaian tidak boleh menyentuh akun buku kas — gunakan Jurnal (6 Buku Kas) untuk transaksi yang melibatkan kas.");
  }

  const entryNumber = await generateAdjustingEntryNumber(date);

  return prisma.journalEntry.create({
    data: {
      entryNumber,
      date,
      cashBook: null,
      entryType: "JURNAL_PENYESUAIAN",
      description,
      reference: reference ?? null,
      createdById,
      lines: {
        create: [
          { accountId: debitAccountId, debit: amount, credit: 0 },
          { accountId: creditAccountId, debit: 0, credit: amount },
        ],
      },
    },
    include: { lines: { include: { account: true } } },
  });
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
    where: {
      status: "POSTED",
      // TRANSFER_ANTAR_BUKU: both legs are cash, zero net effect (see above).
      // JURNAL_PENYESUAIAN: NEITHER leg is cash, so it has no cash-flow
      // impact either — excluded here rather than relying on the `!cashLine`
      // skip below, so the query itself never fetches rows this report
      // can't use.
      entryType: { notIn: ["TRANSFER_ANTAR_BUKU", "JURNAL_PENYESUAIAN"] },
      date: { gte: yearStart, lte: yearEnd },
    },
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

/** The one non-postable, purely-administrative account code: the final
 * corporate income tax line, reported on its own AFTER "Laba Tahun
 * Berjalan Sebelum Pajak" — deliberately excluded from "Total Beban Non
 * Operasi" itself (see the ChartOfAccount seed comment for this code). */
export const PAJAK_PENGHASILAN_CODE = "90100";

/** The four top-level revenue groups from the Laba-Rugi chart of accounts
 * — shared between the Laba Rugi report's own line items and
 * computeLabaBersihSeries, so "Total Penjualan" can never read two
 * different figures depending on which page computed it. */
export const REVENUE_GROUPS = [
  { code: "41010", label: "PENJUALAN BARANG (FRANCHISE)" },
  { code: "42000", label: "PENJUALAN BARANG (NON FRANCHISE)" },
  { code: "43000", label: "PENJUALAN BARANG PENDUKUNG" },
  { code: "44000", label: "PENDAPATAN USAHA LAIN" },
];

function subtreeNaturalTotal(matrix: MonthlyAccountRow[], rootCode: string): number[] {
  const subtree = accountSubtree(matrix, rootCode);
  return ZERO_12().map((_, i) => subtree.reduce((s, a) => s + typeNaturalValue(a.monthly[i], a.type, a.normalBalance), 0));
}

/** Net income per month, Jan-Dec, computed the same way the Laba Rugi
 * report itself does — shared so Neraca (undistributed profit), Perubahan
 * Ekuitas, and Insight don't re-derive it slightly differently.
 *
 * Every total here is rolled up from an explicit account-code SUBTREE
 * (accountSubtree), the exact same basis the Laba Rugi report's own line
 * items use — never a blanket "every account of this AccountType" sum.
 * That distinction matters: an old/deactivated or otherwise orphaned
 * account of a matching type (not a descendant of any of these root
 * codes) would silently count here but never appear as a line item on the
 * report itself, producing a final total that doesn't match anything the
 * report actually shows (found live: a stray un-voided posting on a
 * deactivated 4-digit legacy revenue account inflated this by its full
 * amount while being completely invisible on the page).
 *
 * Takes the HPP module's own totalHpp series (see getMonthlyHppReport)
 * rather than summing HARGA_POKOK_PENJUALAN-type accounts directly,
 * because Laporan HPP is a periodic-inventory calculation (Awal +
 * Pembelian - Akhir) — a plain type-sum would only capture "Pembelian",
 * silently dropping the inventory Awal/Akhir adjustment. */
export function computeLabaBersihSeries(matrix: MonthlyAccountRow[], hppTotals: number[]): number[] {
  const totalPenjualan = ZERO_12().map((_, i) =>
    REVENUE_GROUPS.reduce((s, g) => s + subtreeNaturalTotal(matrix, g.code)[i], 0),
  );
  const totalBebanOperasional = subtreeNaturalTotal(matrix, "60000");
  const totalPendapatanNonOp = subtreeNaturalTotal(matrix, "70000");
  // "80000 BEBAN NON OPERASI"'s own subtree naturally excludes 90100 (Pajak
  // Penghasilan) since that account was created with no parent at all.
  const totalBebanNonOp = subtreeNaturalTotal(matrix, "80000");
  const pajakAccount = matrix.find((a) => a.code === PAJAK_PENGHASILAN_CODE);
  const pajakPenghasilan = pajakAccount
    ? pajakAccount.monthly.map((v) => typeNaturalValue(v, pajakAccount.type, pajakAccount.normalBalance))
    : ZERO_12();
  return ZERO_12().map(
    (_, i) =>
      totalPenjualan[i] -
      hppTotals[i] -
      totalBebanOperasional[i] +
      totalPendapatanNonOp[i] -
      totalBebanNonOp[i] -
      pajakPenghasilan[i],
  );
}

export type MonthlyAccountRow = {
  accountId: string;
  code: string;
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
  cashBook: CashBook | null;
  parentId: string | null;
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
      parentId: a.parentId,
      opening,
      monthly,
      cumulative,
    };
  });
}

export type WorksheetAccountRow = {
  accountId: string;
  code: string;
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
  /** Cumulative balance as of end of the selected month, from every POSTED
   * entry EXCEPT Jurnal Penyesuaian — the classic "Neraca Saldo" column,
   * before adjustments. */
  trialBalance: number;
  /** Cumulative balance contributed by Jurnal Penyesuaian entries only, as
   * of end of the selected month — the classic "Penyesuaian" column. */
  adjustment: number;
  /** trialBalance + adjustment — "Neraca Saldo Setelah Disesuaikan", what
   * the Laba Rugi/Neraca columns are extended from. */
  adjustedTrialBalance: number;
};

/**
 * The classic 10-column worksheet's first three column-pairs in one query:
 * Neraca Saldo (unadjusted), Penyesuaian, Neraca Saldo Setelah Disesuaikan
 * — for a single selected month, split by whether each posted line came
 * from a Jurnal Penyesuaian entry or not. Mirrors getMonthlyAccountMatrix's
 * opening/year-to-date convention exactly (P&L-type accounts reset to 0
 * every Jan 1; Aset/Kewajiban/Ekuitas carry forward everything before it)
 * so "trialBalance + adjustment" always equals what getMonthlyAccountMatrix
 * itself would report as this account's cumulative balance for the month —
 * this function only exists to split that single number into its two
 * components, not to recompute it differently.
 */
export async function getWorksheetSnapshot(year: number, month: number): Promise<WorksheetAccountRow[]> {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const periodEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)); // last instant of the selected month

  type Sums = { tbDebit: number; tbCredit: number; adjDebit: number; adjCredit: number };
  const zeroSums = (): Sums => ({ tbDebit: 0, tbCredit: 0, adjDebit: 0, adjCredit: 0 });

  const [accounts, openingLines, yearLines] = await Promise.all([
    prisma.chartOfAccount.findMany({ orderBy: { code: "asc" } }),
    prisma.journalEntryLine.findMany({
      where: { journalEntry: { status: "POSTED", date: { lt: yearStart } } },
      select: { accountId: true, debit: true, credit: true, journalEntry: { select: { entryType: true } } },
    }),
    prisma.journalEntryLine.findMany({
      where: { journalEntry: { status: "POSTED", date: { gte: yearStart, lte: periodEnd } } },
      select: { accountId: true, debit: true, credit: true, journalEntry: { select: { entryType: true } } },
    }),
  ]);

  function bucketBy(lines: typeof openingLines): Map<string, Sums> {
    const map = new Map<string, Sums>();
    for (const l of lines) {
      const s = map.get(l.accountId) ?? zeroSums();
      if (l.journalEntry.entryType === "JURNAL_PENYESUAIAN") {
        s.adjDebit += Number(l.debit);
        s.adjCredit += Number(l.credit);
      } else {
        s.tbDebit += Number(l.debit);
        s.tbCredit += Number(l.credit);
      }
      map.set(l.accountId, s);
    }
    return map;
  }
  const openingSums = bucketBy(openingLines);
  const yearSums = bucketBy(yearLines);

  const neracaTypes: AccountType[] = ["ASET", "KEWAJIBAN", "EKUITAS"];

  return accounts.map((a) => {
    const isNeraca = neracaTypes.includes(a.type);
    const os = openingSums.get(a.id) ?? zeroSums();
    const ys = yearSums.get(a.id) ?? zeroSums();
    const openingTb = isNeraca ? signedBalance(os.tbDebit, os.tbCredit, a.normalBalance) : 0;
    const openingAdj = isNeraca ? signedBalance(os.adjDebit, os.adjCredit, a.normalBalance) : 0;
    const trialBalance = openingTb + signedBalance(ys.tbDebit, ys.tbCredit, a.normalBalance);
    const adjustment = openingAdj + signedBalance(ys.adjDebit, ys.adjCredit, a.normalBalance);
    return {
      accountId: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
      normalBalance: a.normalBalance,
      trialBalance,
      adjustment,
      adjustedTrialBalance: trialBalance + adjustment,
    };
  });
}

/** This account plus every descendant under it (children, grandchildren,
 * ...), by code — used to roll up a report-header account (e.g. "56000
 * BEBAN OVERHEAD PABRIK") into one total across its whole subtree. Each
 * account's `monthly`/`cumulative` already reflects only ITS OWN postings
 * (postings never auto-roll-up), so summing every row in this list is safe
 * and never double-counts. */
export function accountSubtree(matrix: MonthlyAccountRow[], rootCode: string): MonthlyAccountRow[] {
  const root = matrix.find((a) => a.code === rootCode);
  if (!root) return [];
  const out: MonthlyAccountRow[] = [root];
  const stack = [root.accountId];
  while (stack.length) {
    const parentId = stack.pop()!;
    for (const a of matrix.filter((r) => r.parentId === parentId)) {
      out.push(a);
      stack.push(a.accountId);
    }
  }
  return out;
}

export type CashFlowActivity = "OPERASI" | "INVESTASI" | "PENDANAAN";

/** Which of the three cash-flow activities a cash movement belongs to,
 * based on the TYPE (and, for Aset, the code prefix) of the account on the
 * *other* side of the entry from the cash book — the direct method reads
 * straight off this classification since every entry already touches cash
 * on one leg (see the JournalEntryLine model comment). */
const ZERO_12 = () => Array.from({ length: 12 }, () => 0);
function addMonthly(...series: number[][]): number[] {
  return ZERO_12().map((_, i) => series.reduce((s, arr) => s + arr[i], 0));
}

const HPP_CATEGORY_PARENT_CODE: Record<InventoryCategory, string> = {
  BAHAN_BAKU: "51000",
  BAHAN_SETENGAH_JADI: "52000",
  BARANG_JADI: "53000",
  BAHAN_PENDUKUNG: "54000",
  PROYEK_DALAM_PENYELESAIAN: "59000",
};
export const HPP_CATEGORY_LABEL: Record<InventoryCategory, string> = {
  BAHAN_BAKU: "BAHAN BAKU",
  BAHAN_SETENGAH_JADI: "BAHAN SETENGAH JADI",
  BARANG_JADI: "BARANG JADI",
  BAHAN_PENDUKUNG: "BAHAN PENDUKUNG",
  PROYEK_DALAM_PENYELESAIAN: "PROYEK DALAM PENYELESAIAN",
};
const HPP_MATERIAL_CATEGORIES: InventoryCategory[] = ["BAHAN_BAKU", "BAHAN_SETENGAH_JADI", "BARANG_JADI", "BAHAN_PENDUKUNG"];

export type HppCategoryLine = {
  category: InventoryCategory;
  label: string;
  awal: number[];
  pembelian: number[];
  akhir: number[];
  pemakaian: number[];
  purchaseAccounts: MonthlyAccountRow[];
  /** Months (1-12) missing a recorded Persediaan Akhir — Awal/Akhir/
   * Pemakaian for that month default to 0 (last known figure carried
   * nowhere), so this list is how the report flags "belum tutup buku"
   * instead of silently showing a misleading number. */
  monthsMissingClosing: number[];
};

export type HppReport = {
  categories: HppCategoryLine[];
  totalPemakaianBahan: number[];
  overheadAccounts: MonthlyAccountRow[];
  totalOverhead: number[];
  jumlahBebanProduksi: number[];
  proyek: HppCategoryLine;
  /** HARGA POKOK PENJUALAN — the accrual/management-costing figure this
   * report's own bottom line shows: Awal + Pembelian - Akhir per category,
   * i.e. cost of goods ACTUALLY CONSUMED this period (not necessarily what
   * was paid in cash). Use this for margin/costing analysis (Laporan HPP
   * itself, Analisis & Insight); do NOT feed it into the formal Laba
   * Rugi/Neraca — see cashBasisHpp. */
  totalHpp: number[];
  /** The same cost roll-up computed WITHOUT the Persediaan Awal/Akhir
   * adjustment — i.e. exactly what was actually paid in cash for
   * Pembelian + Beban Overhead Pabrik + Proyek this period. This whole ERP
   * is deliberately cash-basis (every JournalEntry always touches a real
   * cash book — see postCashVoucher), so the formal Laba Rugi and Neraca
   * MUST use this figure, not totalHpp: a stock-opname "Persediaan Akhir"
   * is a report-only input with no corresponding ChartOfAccount asset
   * ever debited for it, so subtracting it from HPP would shrink the
   * expense side without any matching asset appearing anywhere on the
   * Neraca — an unbalanceable phantom. Laporan HPP shows both bases side
   * by side so the difference (unconsumed inventory sitting in cash spent
   * this period) is visible, not hidden. */
  cashBasisHpp: number[];
};

/**
 * Laporan HPP — periodic-inventory cost-of-goods build-up: for each of the
 * four material categories (Bahan Baku, Bahan Setengah Jadi, Barang Jadi,
 * Bahan Pendukung), Pemakaian = Persediaan Awal + Pembelian - Persediaan
 * Akhir, where Awal/Akhir come from a physical stock-opname recorded once
 * per month (InventoryClosingBalance) — NOT from a live asset-account
 * balance, since these categories aren't tracked as perpetual-inventory
 * ledger accounts. Beban Overhead Pabrik (56000's whole subtree) is a
 * straightforward period expense, added on top of the four categories'
 * Pemakaian. Proyek Dalam Penyelesaian (WIP project cost) uses the exact
 * same Awal+Movement-Akhir shape as the material categories.
 */
export async function getMonthlyHppReport(year: number): Promise<HppReport> {
  const [matrix, closingRows] = await Promise.all([
    getMonthlyAccountMatrix(year),
    prisma.inventoryClosingBalance.findMany({
      where: { OR: [{ year }, { year: year - 1, month: 12 }] },
    }),
  ]);

  const closingMap = new Map<string, number>();
  for (const r of closingRows) closingMap.set(`${r.year}-${r.month}-${r.category}`, Number(r.amount));
  const closingRecorded = new Set<string>();
  for (const r of closingRows) closingRecorded.add(`${r.year}-${r.month}-${r.category}`);
  const closingFor = (y: number, m: number, category: InventoryCategory) => closingMap.get(`${y}-${m}-${category}`) ?? 0;
  const hasClosing = (y: number, m: number, category: InventoryCategory) => closingRecorded.has(`${y}-${m}-${category}`);

  function buildCategoryLine(category: InventoryCategory): HppCategoryLine {
    const parentCode = HPP_CATEGORY_PARENT_CODE[category];
    const subtree = accountSubtree(matrix, parentCode);
    const purchaseAccounts = subtree.filter((a) => a.code !== parentCode && a.monthly.some((v) => v !== 0));
    const pembelian = addMonthly(...subtree.map((a) => a.monthly.map((v) => typeNaturalValue(v, a.type, a.normalBalance))));

    const awal: number[] = [];
    const akhir: number[] = [];
    const pemakaian: number[] = [];
    const monthsMissingClosing: number[] = [];
    for (let i = 0; i < 12; i++) {
      const month = i + 1;
      const a = month === 1 ? closingFor(year - 1, 12, category) : closingFor(year, month - 1, category);
      const k = closingFor(year, month, category);
      awal.push(a);
      akhir.push(k);
      pemakaian.push(a + pembelian[i] - k);
      if (!hasClosing(year, month, category)) monthsMissingClosing.push(month);
    }

    return { category, label: HPP_CATEGORY_LABEL[category], awal, pembelian, akhir, pemakaian, purchaseAccounts, monthsMissingClosing };
  }

  const categories = HPP_MATERIAL_CATEGORIES.map(buildCategoryLine);
  const totalPemakaianBahan = addMonthly(...categories.map((c) => c.pemakaian));

  const overheadSubtree = accountSubtree(matrix, "56000");
  const overheadAccounts = overheadSubtree.filter((a) => a.code !== "56000" && a.monthly.some((v) => v !== 0));
  const totalOverhead = addMonthly(...overheadSubtree.map((a) => a.monthly.map((v) => typeNaturalValue(v, a.type, a.normalBalance))));

  const jumlahBebanProduksi = addMonthly(totalPemakaianBahan, totalOverhead);

  const proyek = buildCategoryLine("PROYEK_DALAM_PENYELESAIAN");
  const totalHpp = addMonthly(jumlahBebanProduksi, proyek.pemakaian);

  const totalPembelianCash = addMonthly(...categories.map((c) => c.pembelian));
  const cashBasisHpp = addMonthly(totalPembelianCash, totalOverhead, proyek.pembelian);

  return { categories, totalPemakaianBahan, overheadAccounts, totalOverhead, jumlahBebanProduksi, proyek, totalHpp, cashBasisHpp };
}

export function classifyCashFlowActivity(contraType: AccountType, contraCode: string): CashFlowActivity {
  if (contraType === "EKUITAS" || contraCode === "21300") return "PENDANAAN"; // Modal / Hutang Bank
  if (contraType === "ASET" && contraCode.startsWith("18")) return "INVESTASI"; // Aset Tetap
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

export type AnnualFinancialSummary = {
  year: number;
  totalPenjualan: number;
  hpp: number; // basis kas — see cashBasisHpp
  labaKotor: number;
  bebanOperasional: number;
  labaOperasi: number;
  pendapatanNonOperasi: number;
  bebanNonOperasi: number;
  labaSebelumPajak: number;
  pajakPenghasilan: number;
  labaBersih: number; // "Setelah Accrual" — same figure Laba Rugi/Neraca share
  totalAktiva: number;
  totalKewajiban: number;
  totalEkuitas: number;
};

/**
 * One year's headline HPP/Laba-Rugi/Neraca figures, built from the exact
 * same shared engine every single-year report page already uses
 * (getMonthlyAccountMatrix, getMonthlyHppReport, computeLabaBersihSeries,
 * accountSubtree) — so a multi-year comparison page can never show a
 * figure that disagrees with what that year's own report page displays.
 * P&L lines are the full year's sum (Jan-Dec); Neraca lines are the
 * December-end cumulative balance (a not-yet-finished year's December
 * simply carries forward whatever the last posted month left it at).
 */
/** This ERP's books effectively start here (no company data exists before
 * it). Needed only to correctly carry an undistributed prior year's net
 * income forward into a LATER year's Ekuitas — there is no formal annual
 * closing step (see the "33000 Laba (Rugi) Tahun Berjalan" seed comment),
 * so without this, a future year with zero activity of its own would show
 * Ekuitas dropping back to just its recorded accounts (Modal, Laba
 * Ditahan), silently losing every prior year's unclosed profit. */
const COMPANY_INCEPTION_YEAR = 2026;

async function priorYearsLabaBersih(uptoYearExclusive: number): Promise<number> {
  let total = 0;
  for (let y = COMPANY_INCEPTION_YEAR; y < uptoYearExclusive; y++) {
    const [m, h] = await Promise.all([getMonthlyAccountMatrix(y), getMonthlyHppReport(y)]);
    total += computeLabaBersihSeries(m, h.cashBasisHpp).reduce((s, v) => s + v, 0);
  }
  return total;
}

export async function getAnnualFinancialSummary(year: number): Promise<AnnualFinancialSummary> {
  const [matrix, hppReport, priorLaba] = await Promise.all([
    getMonthlyAccountMatrix(year),
    getMonthlyHppReport(year),
    priorYearsLabaBersih(year),
  ]);

  const yearSum = (values: number[]) => values.reduce((s, v) => s + v, 0);
  function subtreeYearTotal(rootCode: string): number {
    const accounts = accountSubtree(matrix, rootCode).filter((a) => a.code !== rootCode);
    return yearSum(addMonthly(...accounts.map((a) => a.monthly.map((v) => typeNaturalValue(v, a.type, a.normalBalance)))));
  }
  function subtreeDecemberCumulative(rootCode: string, filter?: (a: MonthlyAccountRow) => boolean): number {
    const accounts = accountSubtree(matrix, rootCode).filter((a) => a.code !== rootCode && (!filter || filter(a)));
    return accounts.reduce((s, a) => s + typeNaturalValue(a.cumulative[11], a.type, a.normalBalance), 0);
  }

  // Sum of 12-month totals across the 4 revenue groups — computed per group
  // then summed, matching how the Laba Rugi page itself derives "Total
  // Penjualan" (never a single flat PENDAPATAN-type sum, see that page's
  // own comment on why that silently includes orphaned accounts).
  const totalPenjualan = REVENUE_GROUPS.reduce((s, g) => s + subtreeYearTotal(g.code), 0);

  const hpp = yearSum(hppReport.cashBasisHpp);
  const labaKotor = totalPenjualan - hpp;
  const bebanOperasional = subtreeYearTotal("60000");
  const labaOperasi = labaKotor - bebanOperasional;
  const pendapatanNonOperasi = subtreeYearTotal("70000");
  const bebanNonOperasi = subtreeYearTotal("80000");
  const labaSebelumPajak = labaOperasi + pendapatanNonOperasi - bebanNonOperasi;
  const pajakAccount = matrix.find((a) => a.code === PAJAK_PENGHASILAN_CODE);
  const pajakPenghasilan = pajakAccount
    ? yearSum(pajakAccount.monthly.map((v) => typeNaturalValue(v, pajakAccount.type, pajakAccount.normalBalance)))
    : 0;
  const labaBersihSeries = computeLabaBersihSeries(matrix, hppReport.cashBasisHpp);
  const labaBersih = yearSum(labaBersihSeries);

  const totalAset = subtreeDecemberCumulative("10000");
  const totalAsetTetap = subtreeDecemberCumulative("18000", (a) => a.normalBalance === "DEBIT");
  const totalAkumulasiPenyusutan = subtreeDecemberCumulative("18000", (a) => a.normalBalance === "KREDIT");
  const totalAsetTakBerwujud = subtreeDecemberCumulative("19000");
  const totalAktiva = totalAset + totalAsetTetap + totalAkumulasiPenyusutan + totalAsetTakBerwujud;
  const totalKewajiban = subtreeDecemberCumulative("21000");
  const totalEkuitasRecorded = subtreeDecemberCumulative("30000", (a) => a.code !== "33000");
  let runningLaba = 0;
  const labaBerjalanCumulative = labaBersihSeries.map((v) => (runningLaba += v));
  const totalEkuitas = totalEkuitasRecorded + priorLaba + labaBerjalanCumulative[11];

  return {
    year,
    totalPenjualan,
    hpp,
    labaKotor,
    bebanOperasional,
    labaOperasi,
    pendapatanNonOperasi,
    bebanNonOperasi,
    labaSebelumPajak,
    pajakPenghasilan,
    labaBersih,
    totalAktiva,
    totalKewajiban,
    totalEkuitas,
  };
}
