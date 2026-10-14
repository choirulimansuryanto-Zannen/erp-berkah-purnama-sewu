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

      <Card className="overflow-hidden border-2 border-slate-900 p-0">
        <div className="grid lg:grid-cols-[1.6fr_1fr]">
          <div className="divide-y divide-slate-900/20">
            <div className="grid grid-cols-[110px_1fr] items-stretch">
              <span className="flex items-center bg-[#dbe3b4] px-3 py-2 text-xs font-bold italic text-slate-900">Nama Buku</span>
              <span className="flex items-center gap-2 bg-[#1f3864] px-3 py-2">
                <span className="text-sm font-bold italic text-[#ffd966]">{account.name}</span>
                <span className="rounded bg-[#b8cce4] px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-900">{account.code}</span>
              </span>
            </div>
            <div className="grid grid-cols-[110px_1fr] items-stretch">
              <span className="flex items-center bg-[#dbe3b4] px-3 py-2 text-xs font-bold italic text-slate-900">Periode</span>
              <span className="flex items-center gap-2 bg-white px-3 py-2">
                <span className="rounded bg-[#b8cce4] px-2 py-0.5 text-xs font-semibold text-slate-900">{month}</span>
                <span className="rounded bg-[#b8cce4] px-2 py-0.5 text-xs font-semibold text-slate-900">{year}</span>
                <span className="text-sm font-bold italic text-rose-600">{MONTH_LABELS_ID[month - 1]} {year}</span>
              </span>
            </div>
            <div className="grid grid-cols-[110px_1fr] items-stretch">
              <span className="flex items-center bg-[#dbe3b4] px-3 py-2 text-xs font-bold italic text-slate-900">Officer</span>
              <span className="flex items-center bg-white px-3 py-2">
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
              </span>
            </div>
            <div className="grid grid-cols-[110px_1fr] items-stretch">
              <span className="flex items-center bg-[#dbe3b4] px-3 py-2 text-xs font-bold italic text-slate-900">Saldo Awal</span>
              <span className="flex items-center bg-[#f2dcdb] px-3 py-2 text-sm font-bold text-slate-900">{currency.format(saldoAwal)}</span>
            </div>
            <div className="grid grid-cols-[110px_1fr] items-stretch">
              <span className="flex items-center bg-[#dbe3b4] px-3 py-2 text-xs font-bold italic text-slate-900">Company</span>
              <span className="flex items-center bg-white px-3 py-2 text-sm font-bold text-rose-600">{COMPANY_NAME}</span>
            </div>
          </div>

          <div className="border-t-2 border-slate-900 lg:border-l-2 lg:border-t-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#8fa968] text-white">
                  <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide">Balance</th>
                  <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wide">1</th>
                  <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wide">{yyyymm}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/10">
                <tr>
                  <td className="bg-[#dbe3b4] px-3 py-2 font-bold italic text-slate-900">Begining</td>
                  <td className="bg-white px-3 py-2 text-right tabular-nums">
                    <BalanceCell value={saldoAwal} />
                  </td>
                  <td className="bg-white px-3 py-2 text-right tabular-nums">
                    <BalanceCell value={saldoAwal} />
                  </td>
                </tr>
                <tr>
                  <td className="bg-[#dbe3b4] px-3 py-2 font-bold italic text-slate-900">DB</td>
                  <td className="bg-white px-3 py-2 text-right tabular-nums">
                    <BalanceCell value={db1} />
                  </td>
                  <td className="bg-white px-3 py-2 text-right tabular-nums">
                    <BalanceCell value={dbMonth} />
                  </td>
                </tr>
                <tr>
                  <td className="bg-[#dbe3b4] px-3 py-2 font-bold italic text-slate-900">CR</td>
                  <td className="bg-white px-3 py-2 text-right tabular-nums">
                    <BalanceCell value={-cr1} />
                  </td>
                  <td className="bg-white px-3 py-2 text-right tabular-nums">
                    <BalanceCell value={-crMonth} />
                  </td>
                </tr>
                <tr className="bg-[#c4d79b] font-bold text-slate-900">
                  <td className="px-3 py-2 italic">Ending</td>
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
