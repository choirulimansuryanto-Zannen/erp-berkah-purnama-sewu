import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { Wallet, TrendingDown, TrendingUp, Store } from "lucide-react";

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
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const rangeFrom = from ? new Date(`${from}T00:00:00`) : defaultFrom;
  const rangeTo = to ? new Date(`${to}T23:59:59.999`) : now;

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
        description="Rekap keuangan per outlet — dari laporan harian (Setoran) yang sudah diverifikasi SPV, per outlet."
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
            </tr>
          </Thead>
          <tbody>
            {rows.map((r) => (
              <Tr key={r.id}>
                <Td className="font-medium text-slate-900">{r.name}</Td>
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
              </Tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={9}>Belum ada laporan terverifikasi pada periode ini.</EmptyRow>}
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
              </tr>
            </tfoot>
          )}
        </Table>
      </Card>
    </div>
  );
}
