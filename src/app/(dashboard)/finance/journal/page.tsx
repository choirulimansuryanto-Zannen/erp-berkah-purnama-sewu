import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { JournalVoucherForm } from "@/components/finance/journal-voucher-form";
import { JournalEntryList, type JournalEntryRow } from "@/components/finance/journal-entry-list";
import { CASH_BOOK_LABELS } from "@/lib/accounting";
import { cn } from "@/lib/cn";

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function FinanceJournalPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; book?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "finance:view_ledger")) redirect("/dashboard");

  const { from, to, book: bookParam } = await searchParams;
  const activeBook = bookParam && bookParam in CASH_BOOK_LABELS ? (bookParam as keyof typeof CASH_BOOK_LABELS) : null;
  let rangeFrom: Date;
  let rangeTo: Date;
  if (from || to) {
    const fallback30 = new Date();
    fallback30.setDate(fallback30.getDate() - 29);
    rangeFrom = from ? new Date(`${from}T00:00:00`) : fallback30;
    rangeTo = to ? new Date(`${to}T00:00:00`) : new Date();
  } else {
    // No range picked — default to the last 30 days, but if that has no
    // entries yet (a demo/staging environment's fixed sample data will
    // eventually fall behind "today" no matter what fixed offset is
    // chosen), fall back to the last 30 days ENDING at the most recent
    // posted entry instead of showing a confusing all-zero page.
    const now = new Date();
    const last30Start = new Date();
    last30Start.setDate(last30Start.getDate() - 29);
    const recentCount = await prisma.journalEntry.count({
      where: { date: { gte: last30Start, lte: now }, entryType: { not: "JURNAL_PENYESUAIAN" } },
    });
    if (recentCount > 0) {
      rangeFrom = last30Start;
      rangeTo = now;
    } else {
      const latest = await prisma.journalEntry.findFirst({
        where: { entryType: { not: "JURNAL_PENYESUAIAN" } },
        orderBy: { date: "desc" },
      });
      if (latest) {
        rangeTo = latest.date;
        rangeFrom = new Date(latest.date);
        rangeFrom.setDate(rangeFrom.getDate() - 29);
      } else {
        rangeFrom = last30Start;
        rangeTo = now;
      }
    }
  }

  const [accounts, outlets, entries] = await Promise.all([
    prisma.chartOfAccount.findMany({ where: { status: "ACTIVE" }, orderBy: { code: "asc" } }),
    prisma.outlet.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    // Jurnal Penyesuaian entries live on their own dedicated page (they
    // don't belong to any of the six books, and this page's form can't
    // create them) — excluded here so "Riwayat Jurnal" stays cash-voucher-only.
    prisma.journalEntry.findMany({
      where: { date: { gte: rangeFrom, lte: rangeTo }, entryType: { not: "JURNAL_PENYESUAIAN" } },
      include: { lines: { include: { account: true } }, outlet: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 300,
    }),
  ]);

  const rows: JournalEntryRow[] = entries.map((e) => {
    const cashLine = e.lines.find((l) => l.account.cashBook);
    const contraLine = e.lines.find((l) => !l.account.cashBook) ?? e.lines.find((l) => l.accountId !== cashLine?.accountId);
    const amount = e.lines.reduce((sum, l) => sum + Number(l.debit), 0);
    return {
      id: e.id,
      entryNumber: e.entryNumber,
      date: e.date.toISOString(),
      cashBook: e.cashBook,
      entryType: e.entryType,
      description: e.description,
      reference: e.reference,
      status: e.status,
      outletName: e.outlet?.name ?? null,
      amount,
      cashLine: cashLine ? `${cashLine.account.code} ${cashLine.account.name}` : "-",
      contraLine: contraLine ? `${contraLine.account.code} ${contraLine.account.name}` : "-",
    };
  });

  const cashBookTotals = (Object.keys(CASH_BOOK_LABELS) as (keyof typeof CASH_BOOK_LABELS)[]).map((book) => {
    const bookEntries = entries.filter((e) => e.cashBook === book && e.status === "POSTED");
    return { book, label: CASH_BOOK_LABELS[book], count: bookEntries.length };
  });

  // Clicking a buku kas box filters "Riwayat Jurnal" below to just that
  // book's entries — the box's own link (and the date range it carries)
  // stays put, only `book` changes, so the period picked up top survives.
  const dateQuery = `from=${localDateStr(rangeFrom)}&to=${localDateStr(rangeTo)}`;
  const filteredRows = activeBook ? rows.filter((r) => r.cashBook === activeBook) : rows;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jurnal — 6 Buku Kas"
        description="Input Kas Masuk, Kas Keluar, dan Transfer Antar Buku — setiap entri otomatis berimbang (debit = kredit). Klik salah satu buku kas untuk memfilter Riwayat Jurnal di bawah."
        actions={<DateRangeFilter from={localDateStr(rangeFrom)} to={localDateStr(rangeTo)} />}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cashBookTotals.map((c) => (
          <Link
            key={c.book}
            href={`?${dateQuery}&book=${c.book}`}
            className={cn(
              "rounded-xl border p-3 text-center shadow-[var(--shadow-card)] transition-colors",
              activeBook === c.book
                ? "border-accent-500 bg-accent-50 ring-1 ring-accent-500"
                : "border-slate-200/70 bg-white hover:border-accent-300 hover:bg-accent-50/40",
            )}
          >
            <p className={cn("text-[11px] font-semibold uppercase tracking-wide", activeBook === c.book ? "text-accent-700" : "text-slate-400")}>
              {c.label}
            </p>
            <p className="mt-1 text-lg font-bold text-brand-900">{c.count}</p>
            <p className="text-[10px] text-slate-400">entri periode ini</p>
          </Link>
        ))}
      </div>
      {activeBook && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">
            Menampilkan hanya <span className="font-bold text-accent-700">{CASH_BOOK_LABELS[activeBook]}</span>.
          </span>
          <Link href={`?${dateQuery}`} className="font-bold text-accent-700 hover:text-accent-800">
            Tampilkan semua buku kas →
          </Link>
        </div>
      )}

      <JournalVoucherForm
        accounts={accounts.map((a) => ({ id: a.id, code: a.code, name: a.name, type: a.type, cashBook: a.cashBook }))}
        outlets={outlets}
      />

      <Card>
        <CardHeader>
          <CardTitle>
            Riwayat Jurnal ({filteredRows.length}){activeBook ? ` — ${CASH_BOOK_LABELS[activeBook]}` : ""}
          </CardTitle>
        </CardHeader>
        <JournalEntryList entries={filteredRows} />
      </Card>
    </div>
  );
}
