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
