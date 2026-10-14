import "server-only";
import { prisma } from "@/lib/prisma";
import type { CashBook } from "@prisma/client";

export type BukuKasHeaderData = {
  account: { code: string; name: string };
  officerName: string | null;
  saldoAwal: number;
  db1: number;
  cr1: number;
  dbMonth: number;
  crMonth: number;
  endingDay1: number;
  endingMonth: number;
};

// Shared by the dedicated Buku Kas header report (finance/journal/buku-
// kas/[cashBook]) and the inline header shown on the Jurnal page itself
// when one Buku Kas is filtered — same numbers, same formula, two
// places to see them (added 2026-10-14 after "dimana headernya?": the
// separate page alone wasn't discoverable enough).
export async function getBukuKasHeaderData(cashBook: CashBook, month: number, year: number): Promise<BukuKasHeaderData | null> {
  const periodStart = new Date(Date.UTC(year, month - 1, 1));
  const periodEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  const day1End = new Date(Date.UTC(year, month - 1, 1, 23, 59, 59, 999));

  const [account, officer, linesBefore, linesInPeriod] = await Promise.all([
    prisma.chartOfAccount.findFirst({ where: { cashBook }, select: { code: true, name: true } }),
    prisma.cashBookOfficer.findUnique({ where: { cashBook } }),
    prisma.journalEntryLine.findMany({
      where: { account: { cashBook }, journalEntry: { date: { lt: periodStart } } },
      select: { debit: true, credit: true },
    }),
    prisma.journalEntryLine.findMany({
      where: { account: { cashBook }, journalEntry: { date: { gte: periodStart, lte: periodEnd } } },
      select: { debit: true, credit: true, journalEntry: { select: { date: true } } },
    }),
  ]);
  if (!account) return null;

  // Beginning balance = every line against this book's own account dated
  // before the period — ASET accounts (every cash book's control account
  // is one) are debit-normal, so debit grows the balance and credit
  // shrinks it.
  const saldoAwal = linesBefore.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0);

  const day1Lines = linesInPeriod.filter((l) => l.journalEntry.date <= day1End);
  const db1 = day1Lines.reduce((s, l) => s + Number(l.debit), 0);
  const cr1 = day1Lines.reduce((s, l) => s + Number(l.credit), 0);
  const dbMonth = linesInPeriod.reduce((s, l) => s + Number(l.debit), 0);
  const crMonth = linesInPeriod.reduce((s, l) => s + Number(l.credit), 0);

  return {
    account,
    officerName: officer?.officerName ?? null,
    saldoAwal,
    db1,
    cr1,
    dbMonth,
    crMonth,
    endingDay1: saldoAwal + db1 - cr1,
    endingMonth: saldoAwal + dbMonth - crMonth,
  };
}
