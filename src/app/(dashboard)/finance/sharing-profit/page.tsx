import { redirect } from "next/navigation";
import Link from "next/link";
import { Settings, HandCoins } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { StatCard } from "@/components/ui/stat-card";
import { RunCalculationButton } from "@/components/finance/run-calculation-button";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 });
const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

// Laporan Sharing Profit — the investor pool (poolRate% of company Laba
// Bersih this month) split across each active Investor by ownership %.
// Figures come from SharingProfitDistribution rows (src/lib/incentive.ts);
// "Hitung Ulang" re-runs it against the current rate + investor list.
export default async function SharingProfitPage({
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

  const distributions = await prisma.sharingProfitDistribution.findMany({
    where: { year, month },
    include: { investor: true },
    orderBy: { investor: { name: "asc" } },
  });

  const labaBersih = Number(distributions[0]?.labaBersih ?? 0);
  const poolRate = Number(distributions[0]?.poolRate ?? 0);
  const poolAmount = Number(distributions[0]?.poolAmount ?? 0);
  const totalDistributed = distributions.reduce((s, d) => s + Number(d.amount), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan Sharing Profit"
        description="Bagi hasil laba bersih ke investor sesuai persentase kepemilikan masing-masing."
        actions={
          <Link href="/admin/investors" className="inline-flex items-center gap-1.5 text-xs font-bold text-accent-700 hover:text-accent-800">
            <Settings className="h-3.5 w-3.5" /> Atur Investor & Rate
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
            <RunCalculationButton endpoint="/api/finance/sharing-profit" year={year} month={month} />
          </div>
        </form>
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label={`Laba Bersih ${MONTH_NAMES[month - 1]} ${year}`} value={currency.format(labaBersih)} tone="brand" />
        <StatCard label="Rate Pool" value={`${percent.format(poolRate)}%`} tone="accent" />
        <StatCard label="Pool Sharing Profit" value={currency.format(poolAmount)} tone="info" icon={<HandCoins className="h-4 w-4" />} />
        <StatCard label="Investor Dibayar" value={String(distributions.length)} tone="neutral" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Distribusi per Investor</CardTitle>
        </CardHeader>
        <Table>
          <Thead>
            <tr>
              <Th>Investor</Th>
              <Th className="text-right">% Kepemilikan</Th>
              <Th className="text-right">Bagian Sharing Profit</Th>
            </tr>
          </Thead>
          <tbody>
            {distributions.map((d) => (
              <Tr key={d.id}>
                <Td className="font-medium text-slate-900">{d.investor.name}</Td>
                <Td className="text-right">{percent.format(Number(d.ownershipSnapshot))}%</Td>
                <Td className="text-right font-semibold">{currency.format(Number(d.amount))}</Td>
              </Tr>
            ))}
            {distributions.length === 0 && (
              <EmptyRow colSpan={3}>Belum dihitung untuk periode ini — klik &quot;Hitung Ulang Bulan Ini&quot; di atas.</EmptyRow>
            )}
            {distributions.length > 0 && (
              <Tr className="bg-gold-50 font-bold text-brand-900">
                <Td colSpan={2}>TOTAL DIBAGIKAN</Td>
                <Td className="text-right">{currency.format(totalDistributed)}</Td>
              </Tr>
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
