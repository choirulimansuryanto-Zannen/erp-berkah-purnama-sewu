import { redirect } from "next/navigation";
import Link from "next/link";
import { Settings, Sparkles } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { RunCalculationButton } from "@/components/finance/run-calculation-button";
import { INCENTIVE_TYPE_LABELS, INCENTIVE_SCOPE_LABELS, INCENTIVE_BASIS_LABELS } from "@/lib/incentive";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

// Laporan Insentive — company-wide summary across all 10 incentive types
// (Pramu/Pengelola per outlet, SPV per wilayah, everything else company-
// wide), for one selected month. Figures come from IncentiveCalculation
// rows produced by src/lib/incentive.ts — "Hitung Ulang" re-runs it against
// the current rate table and this month's Omset/Laba figures.
export default async function InsentifPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "finance:view_ledger")) redirect("/dashboard");

  const now = new Date();
  const { year: yearParam, month: monthParam } = await searchParams;
  const year = yearParam ? Number(yearParam) : now.getFullYear();
  const month = monthParam ? Number(monthParam) : now.getMonth() + 1;
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  const calculations = await prisma.incentiveCalculation.findMany({
    where: { year, month },
    include: { outlet: { select: { name: true } }, region: { select: { name: true } } },
    orderBy: [{ scope: "asc" }, { type: "asc" }],
  });

  const byType = new Map<string, { total: number; count: number }>();
  for (const c of calculations) {
    const entry = byType.get(c.type) ?? { total: 0, count: 0 };
    entry.total += Number(c.amount);
    entry.count += 1;
    byType.set(c.type, entry);
  }
  const grandTotal = calculations.reduce((s, c) => s + Number(c.amount), 0);
  const outletCount = new Set(calculations.filter((c) => c.outletId).map((c) => c.outletId)).size;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan Insentif"
        description="Summary seluruh perhitungan insentif — Pramu, SPV, Pengelola, Officer/Head Sales, Officer/Head Marketing, Head FA, Head Operasional, Management."
        actions={
          <Link href="/admin/incentive-rules" className="inline-flex items-center gap-1.5 text-xs font-bold text-accent-700 hover:text-accent-800">
            <Settings className="h-3.5 w-3.5" /> Atur Rate
          </Link>
        }
      />

      <Card>
        <form className="flex flex-wrap items-end gap-3 p-5">
          <div>
            <Label className="text-[11px]">Bulan</Label>
            <Select name="month" defaultValue={String(month)} className="mt-1">
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label className="text-[11px]">Tahun</Label>
            <Select name="year" defaultValue={String(year)} className="mt-1">
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="secondary">
            Tampilkan
          </Button>
          <div className="ml-auto">
            <RunCalculationButton endpoint="/api/finance/incentive-calculations" year={year} month={month} />
          </div>
        </form>
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label={`Total Insentif ${MONTH_NAMES[month - 1]} ${year}`} value={currency.format(grandTotal)} tone="brand" icon={<Sparkles className="h-4 w-4" />} />
        <StatCard label="Outlet Dihitung" value={String(outletCount)} tone="accent" />
        <StatCard label="Jenis Insentif Aktif" value={`${byType.size}/10`} tone="info" />
        <StatCard label="Baris Perhitungan" value={String(calculations.length)} tone="neutral" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ringkasan per Jenis</CardTitle>
        </CardHeader>
        <Table>
          <Thead>
            <tr>
              <Th>Jenis Insentif</Th>
              <Th>Lingkup</Th>
              <Th className="text-right">Jumlah Target</Th>
              <Th className="text-right">Total Nominal</Th>
            </tr>
          </Thead>
          <tbody>
            {Object.entries(INCENTIVE_TYPE_LABELS).map(([type, label]) => {
              const entry = byType.get(type);
              const sample = calculations.find((c) => c.type === type);
              return (
                <Tr key={type}>
                  <Td className="font-medium text-slate-900">{label}</Td>
                  <Td>{sample ? INCENTIVE_SCOPE_LABELS[sample.scope] : "-"}</Td>
                  <Td className="text-right">{entry?.count ?? 0}</Td>
                  <Td className="text-right font-semibold">{currency.format(entry?.total ?? 0)}</Td>
                </Tr>
              );
            })}
            <Tr className="bg-gold-50 font-bold text-brand-900">
              <Td colSpan={3}>TOTAL INSENTIF</Td>
              <Td className="text-right">{currency.format(grandTotal)}</Td>
            </Tr>
          </tbody>
        </Table>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rincian per Target ({calculations.length})</CardTitle>
        </CardHeader>
        <Table>
          <Thead>
            <tr>
              <Th>Jenis</Th>
              <Th>Target</Th>
              <Th>Basis</Th>
              <Th className="text-right">Rate</Th>
              <Th className="text-right">Dasar Perhitungan</Th>
              <Th className="text-right">Nominal Insentif</Th>
            </tr>
          </Thead>
          <tbody>
            {calculations.map((c) => (
              <Tr key={c.id}>
                <Td>{INCENTIVE_TYPE_LABELS[c.type]}</Td>
                <Td className="text-xs text-slate-500">{c.outlet?.name ?? c.region?.name ?? "Perusahaan"}</Td>
                <Td>
                  <Badge tone="info">{INCENTIVE_BASIS_LABELS[c.basis]}</Badge>
                </Td>
                <Td className="text-right">{c.basis === "NOMINAL_TETAP" ? currency.format(Number(c.rateSnapshot)) : `${Number(c.rateSnapshot)}%`}</Td>
                <Td className="text-right">{currency.format(Number(c.baseAmount))}</Td>
                <Td className="text-right font-semibold">{currency.format(Number(c.amount))}</Td>
              </Tr>
            ))}
            {calculations.length === 0 && (
              <EmptyRow colSpan={6}>Belum dihitung untuk periode ini — klik &quot;Hitung Ulang Bulan Ini&quot; di atas.</EmptyRow>
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
