import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { ReklasifikasiTable } from "@/components/finance/reklasifikasi-table";
import { CASH_BOOK_LABELS, TRANSITORY_ACCOUNT_CODE } from "@/lib/accounting-labels";
import { cn } from "@/lib/cn";
import type { CashBook, Prisma } from "@prisma/client";

const CASH_BOOKS = Object.keys(CASH_BOOK_LABELS) as CashBook[];
const TRANSITORY_CODES = Object.values(TRANSITORY_ACCOUNT_CODE);

// Every row a Jurnal Excel Import posted lands against its Buku Kas's
// Transitory (suspense) account automatically — no account picker during
// upload (see journal-import.ts). This page is where that gets finished:
// pick the real account for each transaction. Added per explicit
// follow-up request after the upload flow was simplified: "tetap
// memberikan ruang untuk menjurnal setiap transaksi tersebut setelah
// terupload ke sistem" (2026-10-13).
export default async function ReklasifikasiPage({ searchParams }: { searchParams: Promise<{ book?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "finance:manage_journal")) redirect("/dashboard");

  const { book: bookParam } = await searchParams;
  const activeBook = bookParam && (CASH_BOOKS as string[]).includes(bookParam) ? (bookParam as CashBook) : null;

  const journalEntryFilter: Prisma.JournalEntryWhereInput = { status: "POSTED", ...(activeBook ? { cashBook: activeBook } : {}) };
  const baseWhere: Prisma.JournalEntryLineWhereInput = { account: { code: { in: TRANSITORY_CODES } }, journalEntry: journalEntryFilter };

  const [totalPending, lines, accounts, perBookCounts] = await Promise.all([
    prisma.journalEntryLine.count({ where: baseWhere }),
    prisma.journalEntryLine.findMany({
      where: baseWhere,
      include: { journalEntry: { select: { entryNumber: true, date: true, cashBook: true } } },
      orderBy: { journalEntry: { date: "asc" } },
      take: 300,
    }),
    prisma.chartOfAccount.findMany({ where: { status: "ACTIVE", cashBook: null }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
    Promise.all(
      CASH_BOOKS.map(async (book) => ({
        book,
        count: await prisma.journalEntryLine.count({ where: { account: { code: { in: TRANSITORY_CODES } }, journalEntry: { status: "POSTED", cashBook: book } } }),
      })),
    ),
  ]);

  const rows = lines.map((l) => ({
    lineId: l.id,
    entryNumber: l.journalEntry.entryNumber,
    date: l.journalEntry.date.toISOString(),
    cashBook: l.journalEntry.cashBook ?? "",
    description: l.remark ?? "",
    amount: Number(l.debit) || Number(l.credit),
    isDebitSide: l.isDebitSide,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reklasifikasi Jurnal Import"
        description="Setiap transaksi hasil Import Jurnal dari Excel otomatis tercatat sementara ke akun Transitory per Buku Kas. Pilih akun yang sebenarnya untuk tiap transaksi di bawah ini — tidak mempengaruhi saldo kas, hanya mengganti akun lawannya."
        actions={
          <Link href="/finance/journal" className="text-xs font-semibold text-accent-700 hover:text-accent-800">
            ← Kembali ke Jurnal
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <Link
          href="/finance/journal/reklasifikasi"
          className={cn(
            "rounded-xl border p-3 text-center shadow-[var(--shadow-card)] transition-colors",
            !activeBook ? "border-accent-500 bg-accent-50 ring-1 ring-accent-500" : "border-slate-200/70 bg-white hover:border-accent-300 hover:bg-accent-50/40",
          )}
        >
          <p className={cn("text-[11px] font-semibold uppercase tracking-wide", !activeBook ? "text-accent-700" : "text-slate-400")}>Semua</p>
          <p className="mt-1 text-lg font-bold text-brand-900">{totalPending}</p>
          <p className="text-[10px] text-slate-400">menunggu</p>
        </Link>
        {perBookCounts.map((c) => (
          <Link
            key={c.book}
            href={`/finance/journal/reklasifikasi?book=${c.book}`}
            className={cn(
              "rounded-xl border p-3 text-center shadow-[var(--shadow-card)] transition-colors",
              activeBook === c.book ? "border-accent-500 bg-accent-50 ring-1 ring-accent-500" : "border-slate-200/70 bg-white hover:border-accent-300 hover:bg-accent-50/40",
            )}
          >
            <p className={cn("text-[11px] font-semibold uppercase tracking-wide", activeBook === c.book ? "text-accent-700" : "text-slate-400")}>
              {CASH_BOOK_LABELS[c.book]}
            </p>
            <p className="mt-1 text-lg font-bold text-brand-900">{c.count}</p>
            <p className="text-[10px] text-slate-400">menunggu</p>
          </Link>
        ))}
      </div>

      <Card className="p-0">
        <ReklasifikasiTable rows={rows} accounts={accounts} />
      </Card>

      {totalPending > rows.length && (
        <p className="text-xs text-slate-400">
          Menampilkan {rows.length} dari {totalPending} transaksi yang menunggu — pakai filter Buku Kas di atas untuk mempersempit.
        </p>
      )}
    </div>
  );
}
