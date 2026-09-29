import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { Wallet, TrendingDown, TrendingUp, Store, ChevronRight } from "lucide-react";

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
    rangeFrom = from ? new Date(`${from}T00:00:00`) : new Date(now.getFullYear(), now.getMonth(), 1);
    rangeTo = to ? new Date(`${to}T23:59:59.999`) : now;
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
    include: { outlet: true },
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
  const rows = [...byOutlet.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.omset - a.omset);

  const totalOmset = rows.reduce((s, r) => s + r.omset, 0);
  const totalSetoran = rows.reduce((s, r) => s + r.setoran, 0);
  const totalVariance = rows.reduce((s, r) => s + r.variance, 0);
  const totalExpenses = rows.reduce((s, r) => s + r.expenses, 0);

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

      <Card>
        <CardHeader>
          <CardTitle>Rekap per Outlet ({rows.length})</CardTitle>
        </CardHeader>
        <Table>
          <Thead>
            <tr>
              <Th>Outlet</Th>
              <Th>Jml Laporan</Th>
              <Th>Omset</Th>
              <Th>Non-Tunai</Th>
              <Th>Potongan</Th>
              <Th>Beban Operasional</Th>
              <Th>Setoran Fisik</Th>
              <Th>Actual Cash</Th>
              <Th>Variance</Th>
              <Th></Th>
            </tr>
          </Thead>
          <tbody>
            {rows.map((r) => (
              <Tr key={r.id}>
                <Td className="sticky left-0 z-10 bg-white">
                  <Link
                    href={`/finance/outlet/${r.id}`}
                    className="inline-flex items-center gap-1 font-semibold text-accent-700 hover:text-accent-800 hover:underline"
                    title="Buka laporan lengkap 8 sheet outlet ini"
                  >
                    {r.name} <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                  </Link>
                </Td>
                <Td>{r.count}</Td>
                <Td>{currency.format(r.omset)}</Td>
                <Td>{currency.format(r.nonTunai)}</Td>
                <Td>{currency.format(r.potongan)}</Td>
                <Td>{currency.format(r.expenses)}</Td>
                <Td className="font-semibold">{currency.format(r.setoran)}</Td>
                <Td>{currency.format(r.actual)}</Td>
                <Td>
                  <Badge tone={Math.abs(r.variance) < 1 ? "success" : r.variance < 0 ? "danger" : "warning"}>
                    {currency.format(r.variance)}
                  </Badge>
                </Td>
                <Td>
                  <Link
                    href={`/finance/outlet/${r.id}`}
                    className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-accent-50 px-2.5 py-1.5 text-xs font-bold text-accent-700 hover:bg-accent-100"
                  >
                    Detail 8 Sheet <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </Td>
              </Tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={10}>Belum ada laporan terverifikasi pada periode ini.</EmptyRow>}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-brand-900">
                <td className="px-5 py-2.5" colSpan={2}>
                  Total
                </td>
                <td className="px-5 py-2.5">{currency.format(totalOmset)}</td>
                <td className="px-5 py-2.5">{currency.format(rows.reduce((s, r) => s + r.nonTunai, 0))}</td>
                <td className="px-5 py-2.5">{currency.format(rows.reduce((s, r) => s + r.potongan, 0))}</td>
                <td className="px-5 py-2.5">{currency.format(totalExpenses)}</td>
                <td className="px-5 py-2.5">{currency.format(totalSetoran)}</td>
                <td className="px-5 py-2.5">{currency.format(rows.reduce((s, r) => s + r.actual, 0))}</td>
                <td className="px-5 py-2.5">{currency.format(totalVariance)}</td>
                <td className="px-5 py-2.5"></td>
              </tr>
            </tfoot>
          )}
        </Table>
      </Card>
    </div>
  );
}
