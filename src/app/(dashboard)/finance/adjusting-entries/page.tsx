import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { AdjustingEntryForm } from "@/components/finance/adjusting-entry-form";
import { JournalEntryList, type JournalEntryRow } from "@/components/finance/journal-entry-list";

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Jurnal Penyesuaian — the non-cash counterpart to the six-book cash
// vouchers on /finance/journal: depresiasi, akrual, amortisasi dibayar-di-
// muka, koreksi. Every entry here always excludes cash-book accounts on
// both legs (enforced in postAdjustingEntry) since by definition an
// adjusting entry never moves real cash.
export default async function AdjustingEntriesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "finance:view_ledger")) redirect("/dashboard");

  const { from, to } = await searchParams;
  let rangeFrom: Date;
  let rangeTo: Date;
  if (from || to) {
    const fallback90 = new Date();
    fallback90.setDate(fallback90.getDate() - 89);
    rangeFrom = from ? new Date(`${from}T00:00:00`) : fallback90;
    rangeTo = to ? new Date(`${to}T00:00:00`) : new Date();
  } else {
    // No range picked — default to the last 90 days, but if that has no
    // entries yet (a demo/staging environment's fixed sample data will
    // eventually fall behind "today" no matter what fixed offset is
    // chosen), fall back to the 90 days ENDING at the most recent posted
    // adjusting entry instead of showing a confusing all-zero page.
    const now = new Date();
    const last90Start = new Date();
    last90Start.setDate(last90Start.getDate() - 89);
    const recentCount = await prisma.journalEntry.count({
      where: { entryType: "JURNAL_PENYESUAIAN", date: { gte: last90Start, lte: now } },
    });
    if (recentCount > 0) {
      rangeFrom = last90Start;
      rangeTo = now;
    } else {
      const latest = await prisma.journalEntry.findFirst({ where: { entryType: "JURNAL_PENYESUAIAN" }, orderBy: { date: "desc" } });
      if (latest) {
        rangeTo = latest.date;
        rangeFrom = new Date(latest.date);
        rangeFrom.setDate(rangeFrom.getDate() - 89);
      } else {
        rangeFrom = last90Start;
        rangeTo = now;
      }
    }
  }

  const [accounts, entries] = await Promise.all([
    prisma.chartOfAccount.findMany({ where: { status: "ACTIVE" }, orderBy: { code: "asc" } }),
    prisma.journalEntry.findMany({
      where: { entryType: "JURNAL_PENYESUAIAN", date: { gte: rangeFrom, lte: rangeTo } },
      include: { lines: { include: { account: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 300,
    }),
  ]);

  const rows: JournalEntryRow[] = entries.map((e) => {
    const debitLine = e.lines.find((l) => Number(l.debit) > 0);
    const creditLine = e.lines.find((l) => Number(l.credit) > 0);
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
      outletName: null,
      amount,
      cashLine: debitLine ? `${debitLine.account.code} ${debitLine.account.name}` : "-",
      contraLine: creditLine ? `${creditLine.account.code} ${creditLine.account.name}` : "-",
    };
  });

  const activeCount = entries.filter((e) => e.status === "POSTED").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jurnal Penyesuaian"
        description="Entri non-kas akhir periode — depresiasi, akrual, amortisasi dibayar-di-muka, koreksi. Tidak menyentuh akun buku kas manapun."
        actions={<DateRangeFilter from={localDateStr(rangeFrom)} to={localDateStr(rangeTo)} />}
      />

      <div className="rounded-xl border border-slate-200/70 bg-white p-4 shadow-[var(--shadow-card)]">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Jurnal Penyesuaian Aktif (periode ini)</p>
        <p className="mt-1 text-2xl font-bold text-brand-900">{activeCount}</p>
      </div>

      <AdjustingEntryForm accounts={accounts.map((a) => ({ id: a.id, code: a.code, name: a.name, type: a.type, cashBook: a.cashBook }))} />

      <Card>
        <CardHeader>
          <CardTitle>Riwayat Jurnal Penyesuaian ({rows.length})</CardTitle>
        </CardHeader>
        <JournalEntryList entries={rows} />
      </Card>
    </div>
  );
}
