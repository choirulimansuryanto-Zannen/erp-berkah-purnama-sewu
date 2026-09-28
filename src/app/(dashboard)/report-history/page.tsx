import { redirect } from "next/navigation";
import { CheckCircle2, TrendingUp, Wallet } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { getScopedOutletIds } from "@/lib/outlet-scope";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ExportCsvButton } from "@/components/ui/export-csv-button";
import { FormattedBarChart } from "@/components/ui/formatted-charts";
import { DateRangeFilter } from "@/components/ui/date-range-filter";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Archive of every report this SPV (or other validating role) has already
// signed off on — the "Verifikasi Laporan" list only ever shows PENDING,
// so once acted on a report disappears from there; this is where it goes.
export default async function ReportHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "report:validate") && !can(user.role, "report:view_company_wide")) redirect("/dashboard");

  const { from, to } = await searchParams;
  const defaultTo = new Date();
  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 29);
  const rangeFrom = from ? new Date(`${from}T00:00:00`) : defaultFrom;
  rangeFrom.setHours(0, 0, 0, 0);
  const rangeTo = to ? new Date(`${to}T00:00:00`) : defaultTo;
  rangeTo.setHours(23, 59, 59, 999);

  const scopedOutletIds = await getScopedOutletIds(user.id, user.role);
  const outletFilter = scopedOutletIds ? { in: scopedOutletIds } : undefined;

  const reports = await prisma.dailyReport.findMany({
    where: { status: "APPROVED", date: { gte: rangeFrom, lte: rangeTo }, ...(outletFilter ? { outletId: outletFilter } : {}) },
    orderBy: { reviewedAt: "desc" },
    include: { outlet: true, pramuniaga: true, reviewer: true },
  });

  const totalOmset = reports.reduce((sum, r) => sum + Number(r.omset), 0);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const thisMonthCount = reports.filter((r) => r.date >= monthStart).length;

  const byOutlet = new Map<string, number>();
  for (const r of reports) byOutlet.set(r.outlet.name, (byOutlet.get(r.outlet.name) ?? 0) + 1);
  const outletBarData = [...byOutlet.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const csvRows = reports.map((r) => ({
    Tanggal: r.date.toLocaleDateString("id-ID"),
    Outlet: r.outlet.name,
    Pramuniaga: r.pramuniaga.name,
    Omset: Number(r.omset),
    Variance: Number(r.variance),
    "Diverifikasi Oleh": r.reviewer?.name ?? "-",
    "Tanggal Verifikasi": r.reviewedAt ? r.reviewedAt.toLocaleString("id-ID") : "-",
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Histori Laporan Terverifikasi"
        description={
          scopedOutletIds
            ? "Arsip laporan harian yang sudah diverifikasi, dipersempit ke outlet di wilayah Anda."
            : "Arsip seluruh laporan harian yang sudah diverifikasi."
        }
        actions={<DateRangeFilter from={localDateStr(rangeFrom)} to={localDateStr(rangeTo)} />}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Total Terverifikasi" value={String(reports.length)} tone="success" icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard label="Bulan Ini" value={String(thisMonthCount)} tone="brand" icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Total Omset Terverifikasi" value={currency.format(totalOmset)} tone="accent" icon={<Wallet className="h-4 w-4" />} />
      </div>

      {outletBarData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Jumlah Laporan Terverifikasi per Outlet</CardTitle>
          </CardHeader>
          <div className="p-5">
            <FormattedBarChart data={outletBarData} unit="laporan" defaultColor="#059669" />
          </div>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Arsip Laporan</CardTitle>
          <ExportCsvButton rows={csvRows} filename="histori-laporan-terverifikasi.csv" />
        </CardHeader>
        <Table>
          <Thead>
            <tr>
              <Th>Tanggal</Th>
              <Th>Outlet</Th>
              <Th>Pramuniaga</Th>
              <Th>Omset</Th>
              <Th>Variance</Th>
              <Th>Diverifikasi Oleh</Th>
            </tr>
          </Thead>
          <tbody>
            {reports.map((r) => (
              <Tr key={r.id}>
                <Td>{r.date.toLocaleDateString("id-ID")}</Td>
                <Td className="font-medium text-slate-900">{r.outlet.name}</Td>
                <Td>{r.pramuniaga.name}</Td>
                <Td>{currency.format(Number(r.omset))}</Td>
                <Td>{currency.format(Number(r.variance))}</Td>
                <Td>
                  <span className="flex items-center gap-1.5">
                    <Badge tone="success">Terverifikasi</Badge>
                    {r.reviewer?.name ?? "-"}
                  </span>
                </Td>
              </Tr>
            ))}
            {reports.length === 0 && <EmptyRow colSpan={6}>Belum ada laporan yang diverifikasi.</EmptyRow>}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
