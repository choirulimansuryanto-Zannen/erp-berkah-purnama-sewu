import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { Wallet, TrendingDown, TrendingUp, Store } from "lucide-react";
import { SummarySetoranTable, type DailyReportRow } from "@/components/finance/summary-setoran-table";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// FA Outlet is a *report*, not a separate ledger — it reads the same
// DailyReport (Setoran) rows the pramuniaga already submit and SPV already
// verify, rolled up per outlet. FA Company's own six-book journal is where
// the actual company-level bookkeeping lives (see /finance/journal).
export default async function FinanceOutletPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "finance:view_ledger")) redirect("/dashboard");

  const { from, to } = await searchParams;
  const now = new Date();
  let rangeFrom: Date;
  let rangeTo: Date;
  if (from || to) {
    // Appending "Z" forces UTC parsing — DailyReport.date is a @db.Date
    // column (a plain calendar date, no timezone), and without it a
    // date-time string with no offset parses as LOCAL time. On a server
    // whose system timezone is ahead of UTC (this one included), that
    // local midnight falls on the PREVIOUS day in UTC, so the gte bound
    // silently shifts a day earlier and the query pulls in one extra day's
    // report from before the range the user actually picked.
    rangeFrom = from ? new Date(`${from}T00:00:00Z`) : new Date(now.getFullYear(), now.getMonth(), 1);
    rangeTo = to ? new Date(`${to}T23:59:59.999Z`) : now;
  } else {
    // No range picked — default to the current month, but if it has no
    // verified reports yet (a demo/staging environment's fixed sample data
    // will eventually fall behind "today" no matter what fixed offset is
    // chosen), fall back to the month of the most recent verified report
    // instead of showing a confusing all-zero page.
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthHasData = await prisma.dailyReport.count({
      where: { status: "APPROVED", date: { gte: currentMonthStart, lte: now } },
    });
    if (currentMonthHasData > 0) {
      rangeFrom = currentMonthStart;
      rangeTo = now;
    } else {
      const latestReport = await prisma.dailyReport.findFirst({ where: { status: "APPROVED" }, orderBy: { date: "desc" } });
      if (latestReport) {
        rangeFrom = new Date(latestReport.date.getFullYear(), latestReport.date.getMonth(), 1);
        rangeTo = new Date(latestReport.date.getFullYear(), latestReport.date.getMonth() + 1, 0, 23, 59, 59, 999);
      } else {
        rangeFrom = currentMonthStart;
        rangeTo = now;
      }
    }
  }

  const reports = await prisma.dailyReport.findMany({
    where: { status: "APPROVED", date: { gte: rangeFrom, lte: rangeTo } },
    include: { outlet: true, pramuniaga: true },
    orderBy: { date: "asc" },
  });

  const byOutlet = new Map<
    string,
    { name: string; omset: number; nonTunai: number; potongan: number; expenses: number; setoran: number; actual: number; variance: number; count: number }
  >();
  for (const r of reports) {
    const entry = byOutlet.get(r.outletId) ?? {
      name: r.outlet.name,
      omset: 0,
      nonTunai: 0,
      potongan: 0,
      expenses: 0,
      setoran: 0,
      actual: 0,
      variance: 0,
      count: 0,
    };
    entry.omset += Number(r.omset);
    entry.nonTunai += Number(r.nonTunai);
    entry.potongan += Number(r.potongan);
    entry.expenses += Number(r.expenses);
    entry.setoran += Number(r.summarySetoran);
    entry.actual += Number(r.actualCashCounted);
    entry.variance += Number(r.variance);
    entry.count += 1;
    byOutlet.set(r.outletId, entry);
  }
  const outletIds = [...byOutlet.keys()];

  // Kasbon — an append-only log (Kasbon model), not folded into
  // DailyReport.expenses, so it needs its own aggregation to show as a
  // column alongside Beban Operasional (both are deductions from Omset).
  // Fetched as raw rows (not pre-grouped) so the same data can build both
  // the outlet-level total AND the per-day breakdown behind it.
  const kasbonByOutlet = new Map<string, number>();
  const kasbonByOutletDate = new Map<string, number>(); // key: `${outletId}|${yyyy-mm-dd}`
  if (outletIds.length > 0) {
    const kasbonRows = await prisma.kasbon.findMany({
      where: { outletId: { in: outletIds }, date: { gte: rangeFrom, lte: rangeTo } },
      select: { outletId: true, date: true, amount: true },
    });
    for (const k of kasbonRows) {
      const amount = Number(k.amount);
      kasbonByOutlet.set(k.outletId, (kasbonByOutlet.get(k.outletId) ?? 0) + amount);
      const dayKey = `${k.outletId}|${localDateStr(k.date)}`;
      kasbonByOutletDate.set(dayKey, (kasbonByOutletDate.get(dayKey) ?? 0) + amount);
    }
  }

  // Setoran Via — which of the three cash-book destinations an outlet's
  // physical deposit actually went to. This doesn't live on DailyReport at
  // all; it's read from the FA Company journal's own "Kas Outlet" TRANSFER_
  // ANTAR_BUKU entries (OUTLET -> BRANKAS is a cash drop, OUTLET -> a bank
  // is a transfer), which already carry outletId per the routing rules set
  // up on /finance/journal.
  const setoranViaByOutlet = new Map<string, { brankas: number; bca: number; mandiri: number }>();
  if (outletIds.length > 0) {
    const transfers = await prisma.journalEntry.findMany({
      where: {
        cashBook: "OUTLET",
        entryType: "TRANSFER_ANTAR_BUKU",
        status: "POSTED",
        outletId: { in: outletIds },
        date: { gte: rangeFrom, lte: rangeTo },
      },
      include: { lines: { include: { account: true } } },
    });
    for (const t of transfers) {
      if (!t.outletId) continue;
      const destLine = t.lines.find((l) => l.account.cashBook && l.account.cashBook !== "OUTLET");
      if (!destLine) continue;
      const entry = setoranViaByOutlet.get(t.outletId) ?? { brankas: 0, bca: 0, mandiri: 0 };
      const amount = Number(destLine.debit);
      if (destLine.account.cashBook === "BRANKAS") entry.brankas += amount;
      else if (destLine.account.cashBook === "BANK_BCA") entry.bca += amount;
      else if (destLine.account.cashBook === "BANK_MANDIRI") entry.mandiri += amount;
      setoranViaByOutlet.set(t.outletId, entry);
    }
  }

  const rows = [...byOutlet.entries()]
    .map(([id, v]) => ({
      id,
      ...v,
      kasbon: kasbonByOutlet.get(id) ?? 0,
      setoranVia: setoranViaByOutlet.get(id) ?? { brankas: 0, bca: 0, mandiri: 0 },
    }))
    .sort((a, b) => b.omset - a.omset);

  const dailyByOutlet: Record<string, DailyReportRow[]> = {};
  for (const r of reports) {
    const dayKey = `${r.outletId}|${localDateStr(r.date)}`;
    const list = dailyByOutlet[r.outletId] ?? [];
    list.push({
      id: r.id,
      // A plain "YYYY-MM-DD" string, not an ISO timestamp — @db.Date columns
      // come back from pg as a Date built from LOCAL calendar components, so
      // round-tripping through .toISOString() + UTC accessors on the client
      // (a different machine/timezone) can silently shift it a day. A bare
      // date string sidesteps the ambiguity entirely: nobody has to parse it
      // through a Date object at all.
      date: localDateStr(r.date),
      pramuniagaName: r.pramuniaga.name,
      omset: Number(r.omset),
      nonTunai: Number(r.nonTunai),
      potongan: Number(r.potongan),
      expenses: Number(r.expenses),
      kasbon: kasbonByOutletDate.get(dayKey) ?? 0,
      setoran: Number(r.summarySetoran),
      actual: Number(r.actualCashCounted),
      variance: Number(r.variance),
    });
    dailyByOutlet[r.outletId] = list;
  }

  const totalOmset = rows.reduce((s, r) => s + r.omset, 0);
  const totalSetoran = rows.reduce((s, r) => s + r.setoran, 0);
  const totalVariance = rows.reduce((s, r) => s + r.variance, 0);
  const totalExpenses = rows.reduce((s, r) => s + r.expenses, 0);
  const totalKasbon = rows.reduce((s, r) => s + r.kasbon, 0);
  const totalSetoranVia = rows.reduce(
    (s, r) => ({ brankas: s.brankas + r.setoranVia.brankas, bca: s.bca + r.setoranVia.bca, mandiri: s.mandiri + r.setoranVia.mandiri }),
    { brankas: 0, bca: 0, mandiri: 0 },
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="FA Outlet"
        description="Rekap keuangan per outlet — dari laporan harian (Setoran) yang sudah diverifikasi SPV. Klik nama outlet untuk laporan lengkap 8 sheet (Omset, Purchase, Adjustment, Akun, Absen, Insentive, Inventory, Report)."
        actions={<DateRangeFilter from={localDateStr(rangeFrom)} to={localDateStr(rangeTo)} />}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Omset" value={currency.format(totalOmset)} tone="brand" icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="Total Setoran Fisik" value={currency.format(totalSetoran)} tone="accent" icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Total Beban Operasional" value={currency.format(totalExpenses)} tone="neutral" icon={<TrendingDown className="h-4 w-4" />} />
        <StatCard label="Jumlah Outlet" value={String(rows.length)} tone="info" icon={<Store className="h-4 w-4" />} />
      </div>

      <Card className="p-0">
        <CardHeader className="sticky top-16 z-30 h-14 bg-white">
          <CardTitle>Summary Setoran Bersih ({rows.length})</CardTitle>
          <p className="text-xs text-slate-400">Klik panah di samping nama outlet untuk melihat rincian laporan per tanggal.</p>
        </CardHeader>
        <SummarySetoranTable
          rows={rows}
          dailyByOutlet={dailyByOutlet}
          totals={{
            omset: totalOmset,
            nonTunai: rows.reduce((s, r) => s + r.nonTunai, 0),
            potongan: rows.reduce((s, r) => s + r.potongan, 0),
            expenses: totalExpenses,
            kasbon: totalKasbon,
            setoran: totalSetoran,
            actual: rows.reduce((s, r) => s + r.actual, 0),
            variance: totalVariance,
            setoranVia: totalSetoranVia,
          }}
        />
      </Card>
    </div>
  );
}
