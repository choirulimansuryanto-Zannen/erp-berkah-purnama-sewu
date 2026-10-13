import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CASH_BOOK_LABELS } from "@/lib/accounting";
import type { CashBook } from "@prisma/client";

const CASH_BOOKS = Object.keys(CASH_BOOK_LABELS) as CashBook[];
const MONTH_LABELS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const COMPANY_NAME = "PT. Berkah Purnama Sewu";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const number2 = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function BalanceCell({ value }: { value: number }) {
  // Matches the business's own ledger-sheet convention: a credit/outflow
  // shows in parentheses rather than with a minus sign.
  return <span className={value < 0 ? "text-rose-600" : ""}>{value < 0 ? `(${number2.format(Math.abs(value))})` : number2.format(value)}</span>;
}

// Replicates the header block the business already uses on its own
// Excel ledger sheets (Nama Buku / Periode / Officer / Saldo Awal /
// Company, plus a Begining-DB-CR-Ending balance table for day 1 of the
// period vs the whole period) — requested 2026-10-13 right after the
// Excel-import workflow went live, as a printable per-Buku-Kas summary.
export default async function BukuKasHeaderPage({
  params,
  searchParams,
}: {
  params: Promise<{ cashBook: string }>;
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "finance:view_ledger")) redirect("/dashboard");

  const { cashBook: cashBookParam } = await params;
  if (!(CASH_BOOKS as string[]).includes(cashBookParam)) notFound();
  const cashBook = cashBookParam as CashBook;

  const now = new Date();
  const { month: monthParam, year: yearParam } = await searchParams;
  const month = monthParam ? Number(monthParam) : now.getMonth() + 1;
  const year = yearParam ? Number(yearParam) : now.getFullYear();

  const periodStart = new Date(Date.UTC(year, month - 1, 1));
  const periodEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  const day1End = new Date(Date.UTC(year, month - 1, 1, 23, 59, 59, 999));

  const [account, officer, linesBefore, linesInPeriod] = await Promise.all([
    prisma.chartOfAccount.findFirst({ where: { cashBook } }),
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
  if (!account) notFound();

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
  const endingDay1 = saldoAwal + db1 - cr1;
  const endingMonth = saldoAwal + dbMonth - crMonth;

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);
  const yyyymm = `${year}${String(month).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Buku Kas — ${CASH_BOOK_LABELS[cashBook]}`}
        description="Header ringkasan buku kas: saldo awal, mutasi debit/kredit, dan saldo akhir untuk periode yang dipilih."
        actions={
          <Link href="/finance/journal" className="text-xs font-semibold text-accent-700 hover:text-accent-800">
            ← Kembali ke Jurnal
          </Link>
        }
      />

      <Card>
        <form className="flex flex-wrap items-end gap-3 p-5">
          <div>
            <Label className="text-[11px]">Bulan</Label>
            <Select name="month" defaultValue={String(month)} className="mt-1">
              {MONTH_LABELS_ID.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label className="text-[11px]">Tahun</Label>
            <Select name="year" defaultValue={String(year)} className="mt-1">
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="secondary">
            Tampilkan
          </Button>
        </form>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="grid lg:grid-cols-[1.6fr_1fr]">
          <div className="divide-y divide-slate-100">
            <div className="grid grid-cols-[110px_1fr] items-center gap-3 px-5 py-3">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Nama Buku</span>
              <span className="inline-flex w-fit items-center gap-2 rounded-md bg-brand-900 px-3 py-1.5 text-sm font-bold text-white">
                {account.name}
                <span className="rounded bg-white/15 px-1.5 py-0.5 font-mono text-xs font-semibold">{account.code}</span>
              </span>
            </div>
            <div className="grid grid-cols-[110px_1fr] items-center gap-3 px-5 py-3">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Periode</span>
              <span className="text-sm font-bold text-rose-600">
                {month} / {year} — {MONTH_LABELS_ID[month - 1]} {year}
              </span>
            </div>
            <div className="grid grid-cols-[110px_1fr] items-center gap-3 px-5 py-3">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Officer</span>
              {officer ? (
                <span className="text-sm font-bold italic text-rose-600">{officer.officerName}</span>
              ) : (
                <span className="text-xs text-slate-400">
                  Belum diatur —{" "}
                  <Link href="/admin/settings" className="font-semibold text-accent-700 hover:text-accent-800">
                    atur di Admin &gt; Settings
                  </Link>
                </span>
              )}
            </div>
            <div className="grid grid-cols-[110px_1fr] items-center gap-3 px-5 py-3">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Saldo Awal</span>
              <span className="text-sm font-bold text-slate-800">{currency.format(saldoAwal)}</span>
            </div>
            <div className="grid grid-cols-[110px_1fr] items-center gap-3 px-5 py-3">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Company</span>
              <span className="text-sm font-bold text-rose-600">{COMPANY_NAME}</span>
            </div>
          </div>

          <div className="border-t border-slate-100 lg:border-l lg:border-t-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-brand-800 text-white">
                  <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide">Balance</th>
                  <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wide">1</th>
                  <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wide">{yyyymm}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="px-3 py-2 font-semibold text-slate-600">Begining</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <BalanceCell value={saldoAwal} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <BalanceCell value={saldoAwal} />
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-semibold text-slate-600">DB</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <BalanceCell value={db1} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <BalanceCell value={dbMonth} />
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-semibold text-slate-600">CR</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <BalanceCell value={-cr1} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <BalanceCell value={-crMonth} />
                  </td>
                </tr>
                <tr className="bg-emerald-50 font-bold text-emerald-800">
                  <td className="px-3 py-2">Ending</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <BalanceCell value={endingDay1} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <BalanceCell value={endingMonth} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}
