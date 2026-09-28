import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { JournalVoucherForm } from "@/components/finance/journal-voucher-form";
import { JournalEntryList, type JournalEntryRow } from "@/components/finance/journal-entry-list";
import { CASH_BOOK_LABELS } from "@/lib/accounting";

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function FinanceJournalPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "finance:view_ledger")) redirect("/dashboard");

  const { from, to } = await searchParams;
  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 29);
  const rangeFrom = from ? new Date(`${from}T00:00:00`) : defaultFrom;
  const rangeTo = to ? new Date(`${to}T00:00:00`) : new Date();

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jurnal — 6 Buku Kas"
        description="Input Kas Masuk, Kas Keluar, dan Transfer Antar Buku — setiap entri otomatis berimbang (debit = kredit)."
        actions={<DateRangeFilter from={localDateStr(rangeFrom)} to={localDateStr(rangeTo)} />}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cashBookTotals.map((c) => (
          <div key={c.book} className="rounded-xl border border-slate-200/70 bg-white p-3 text-center shadow-[var(--shadow-card)]">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{c.label}</p>
            <p className="mt-1 text-lg font-bold text-brand-900">{c.count}</p>
            <p className="text-[10px] text-slate-400">entri periode ini</p>
          </div>
        ))}
      </div>

      <JournalVoucherForm
        accounts={accounts.map((a) => ({ id: a.id, code: a.code, name: a.name, type: a.type, cashBook: a.cashBook }))}
        outlets={outlets}
      />

      <Card>
        <CardHeader>
          <CardTitle>Riwayat Jurnal ({rows.length})</CardTitle>
        </CardHeader>
        <JournalEntryList entries={rows} />
      </Card>
    </div>
  );
}
