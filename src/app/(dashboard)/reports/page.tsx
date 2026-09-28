import type { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { getScopedOutletIds } from "@/lib/outlet-scope";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { ExportCsvButton } from "@/components/ui/export-csv-button";
import { DateRangeFilter } from "@/components/ui/date-range-filter";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function ManagementReports({
  userId,
  role,
  rangeFrom,
  rangeTo,
}: {
  userId: string;
  role: Role;
  rangeFrom: Date;
  rangeTo: Date;
}) {
  const scopedOutletIds = await getScopedOutletIds(userId, role);

  const reports = await prisma.dailyReport.findMany({
    where: {
      date: { gte: rangeFrom, lte: rangeTo },
      ...(scopedOutletIds ? { outletId: { in: scopedOutletIds } } : {}),
    },
    orderBy: { date: "desc" },
    include: { outlet: true, pramuniaga: true },
  });

  const csvRows = reports.map((r) => ({
    Tanggal: r.date.toLocaleDateString("id-ID"),
    Outlet: r.outlet.name,
    Pramuniaga: r.pramuniaga.name,
    Omset: Number(r.omset),
    "Non-Tunai": Number(r.nonTunai),
    Expenses: Number(r.expenses),
    Variance: Number(r.variance),
    Status: r.status,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Laporan ({reports.length})</CardTitle>
        <ExportCsvButton rows={csvRows} filename="daily-reports.csv" />
      </CardHeader>
      <Table>
        <Thead>
          <tr>
            <Th>Tanggal</Th>
            <Th>Outlet</Th>
            <Th>Pramuniaga</Th>
            <Th>Omset</Th>
            <Th>Variance</Th>
            <Th>Status</Th>
          </tr>
        </Thead>
        <tbody>
          {reports.map((r) => (
            <Tr key={r.id}>
              <Td>{r.date.toLocaleDateString()}</Td>
              <Td className="font-medium text-slate-900">{r.outlet.name}</Td>
              <Td>{r.pramuniaga.name}</Td>
              <Td>{currency.format(Number(r.omset))}</Td>
              <Td>{currency.format(Number(r.variance))}</Td>
              <Td>
                <StatusBadge status={r.status} />
              </Td>
            </Tr>
          ))}
          {reports.length === 0 && <EmptyRow colSpan={6}>Belum ada laporan pada periode ini.</EmptyRow>}
        </tbody>
      </Table>
    </Card>
  );
}

// Pramuniaga's own submit/review flow lives entirely on Summary Setoran
// Outlet now (moved, not duplicated) — this route stays alive only for
// management roles reviewing/validating company-wide reports.
export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role === "PRAMUNIAGA") redirect("/setoran");

  const { from, to } = await searchParams;
  const defaultTo = new Date();
  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 29);

  const rangeFrom = from ? new Date(`${from}T00:00:00`) : defaultFrom;
  rangeFrom.setHours(0, 0, 0, 0);
  const rangeTo = to ? new Date(`${to}T00:00:00`) : defaultTo;
  rangeTo.setHours(23, 59, 59, 999);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Reports"
        description="Rekonsiliasi omset, non-tunai, dan setoran harian."
        actions={<DateRangeFilter from={localDateStr(rangeFrom)} to={localDateStr(rangeTo)} />}
      />
      {can(user.role, "report:validate") || can(user.role, "report:view_company_wide") ? (
        <ManagementReports userId={user.id} role={user.role} rangeFrom={rangeFrom} rangeTo={rangeTo} />
      ) : (
        <p className="text-sm text-slate-500">Tidak ada laporan untuk role ini.</p>
      )}
    </div>
  );
}
