import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Thead, Th, EmptyRow } from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { MonthlyTargetRow } from "@/components/admin/monthly-target-row";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

export default async function OutletTargetsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "admin:system_config")) redirect("/dashboard");

  const { id } = await params;
  const { year: yearParam } = await searchParams;

  const outlet = await prisma.outlet.findUnique({ where: { id }, include: { region: true } });
  if (!outlet) notFound();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const year = Number(yearParam) || currentYear;

  const targets = await prisma.outletMonthlyTarget.findMany({
    where: { outletId: id, year },
    orderBy: { month: "asc" },
  });
  const targetByMonth = new Map(targets.map((t) => [t.month, t]));

  const annualTotal = targets.reduce((sum, t) => sum + Number(t.monthlyTarget), 0);
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Target Bulanan — ${outlet.name}`}
        description={`${outlet.region.name} · Target musiman per bulan (menggantikan target harian statis untuk bulan yang sudah diisi).`}
        actions={
          <Link href="/admin/outlets" className="text-sm font-medium text-accent-700 hover:text-accent-800">
            ← Kembali ke Outlets
          </Link>
        }
      />

      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-500">Tahun:</span>
        {yearOptions.map((y) => (
          <Link
            key={y}
            href={`/admin/outlets/${id}/targets?year=${y}`}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              y === year ? "bg-brand-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300",
            )}
          >
            {y}
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Target {year} — Total Tahunan: {currency.format(annualTotal)}
          </CardTitle>
        </CardHeader>
        <Table>
          <Thead>
            <tr>
              <Th>Bulan</Th>
              <Th>Omset Bulanan (Rp)</Th>
              <Th>Omset Harian (Rp)</Th>
              <Th>Insentif Bulanan (Rp)</Th>
              <Th>Insentif Harian (Rp)</Th>
              <Th>Fullshift Harian (Rp)</Th>
              <Th></Th>
            </tr>
          </Thead>
          <tbody>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
              const t = targetByMonth.get(month);
              return (
                <MonthlyTargetRow
                  key={month}
                  outletId={id}
                  year={year}
                  month={month}
                  monthlyTarget={t ? Number(t.monthlyTarget) : 0}
                  dailyTarget={t ? Number(t.dailyTarget) : 0}
                  insentifMonthlyTarget={t ? Number(t.insentifMonthlyTarget) : 0}
                  insentifDailyTarget={t ? Number(t.insentifDailyTarget) : 0}
                  fullshiftDailyTarget={t ? Number(t.fullshiftDailyTarget) : 0}
                  isCurrentMonth={year === currentYear && month === currentMonth}
                />
              );
            })}
            {targets.length === 0 && (
              <EmptyRow colSpan={7}>Belum ada target untuk tahun {year} — isi manual atau import dari data business.</EmptyRow>
            )}
          </tbody>
        </Table>
      </Card>

      <p className="text-xs text-slate-400">
        Bulan tanpa data yang diisi memakai target harian statis outlet ({currency.format(Number(outlet.dailyTarget))}) sebagai
        fallback di Executive Dashboard.
      </p>
    </div>
  );
}
