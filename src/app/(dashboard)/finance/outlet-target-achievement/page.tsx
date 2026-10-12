import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ExportExcelButton } from "@/components/ui/export-excel-button";
import { getOutletTargetAchievement } from "@/lib/outlet-report";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const KATEGORI_LABEL: Record<string, string> = {
  ACHV_TARGET: "Achv Target",
  DAPAT_INSENTIVE: "Dapat Insentive",
  TIDAK_DAPAT_INSENTIVE: "Tidak dapat Insentive",
};
const KATEGORI_TONE: Record<string, "success" | "info" | "danger"> = {
  ACHV_TARGET: "success",
  DAPAT_INSENTIVE: "info",
  TIDAK_DAPAT_INSENTIVE: "danger",
};

// Pencapaian Target Outlet — every active outlet's monthly Omset target vs.
// actual net sales in one list, for a quick company-wide scan (FA Outlet
// menu, right under Kasbon Pramuniaga). See getOutletTargetAchievement for
// the Target/Actual/Kategori rules.
export default async function OutletTargetAchievementPage({
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

  const rows = await getOutletTargetAchievement(year, month);

  return (
    <div className="space-y-6">
      <PageHeader title="Pencapaian Target Outlet" description="Target omset bulanan vs. penjualan bersih aktual, seluruh outlet aktif, satu periode." />

      <Card>
        <p className="px-5 pt-5 text-sm font-bold text-slate-700">Filter Bulanan</p>
        <form className="flex flex-wrap items-end gap-3 p-5 pt-3">
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
          <Button type="submit" variant="secondary">
            Terapkan
          </Button>
        </form>
        <p className="px-5 pb-4 text-xs text-slate-400">
          Target diambil dari target omset Sales. Actual adalah total penjualan bersih outlet. <strong>Achv Target</strong> = 100% atau lebih.{" "}
          <strong>Tidak dapat Insentive</strong> = di bawah 80% target.
        </p>
      </Card>

      <Card className="p-0" id="target-achievement-section">
        <CardHeader>
          <CardTitle>
            Pencapaian Target — {MONTH_NAMES[month - 1]} {year}
          </CardTitle>
          <ExportExcelButton containerId="target-achievement-section" filename={`Pencapaian_Target_Outlet_${MONTH_NAMES[month - 1]}_${year}.xlsx`} />
        </CardHeader>
        <Table data-sheet-name="Pencapaian_Target" wrapperClassName="max-h-[75vh] overflow-auto">
          <Thead className="sticky top-0 z-20 bg-slate-50">
            <tr>
              <Th>No.</Th>
              <Th>Outlet</Th>
              <Th>Area</Th>
              <Th className="text-right">Target</Th>
              <Th className="text-right">Actual</Th>
              <Th className="text-right">% Pencapaian</Th>
              <Th>Kategori</Th>
            </tr>
          </Thead>
          <tbody>
            {rows.map((r, idx) => (
              <Tr key={r.outletId}>
                <Td>{idx + 1}</Td>
                <Td className="font-bold text-slate-900">{r.outletName}</Td>
                <Td>{r.area}</Td>
                <Td className="text-right tabular-nums">{currency.format(r.target)}</Td>
                <Td className="text-right tabular-nums">{currency.format(r.actual)}</Td>
                <Td className="text-right font-bold tabular-nums">{percent.format(r.pct)}%</Td>
                <Td>
                  <Badge tone={KATEGORI_TONE[r.kategori]}>{KATEGORI_LABEL[r.kategori]}</Badge>
                </Td>
              </Tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={7}>Belum ada outlet aktif.</EmptyRow>}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
