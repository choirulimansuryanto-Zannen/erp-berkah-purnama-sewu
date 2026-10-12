import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Label, Select, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { ExportExcelButton } from "@/components/ui/export-excel-button";
import { getFullshiftReport } from "@/lib/outlet-report";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const number0 = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function monthRange(year: number, month: number) {
  return { start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)) };
}

// Laporan Fullshift — per pramuniaga, how many days this period their
// outlet hit its Fullshift Daily Target while they were on duty, against
// an annual quota, paid Rp50.000/day. See getFullshiftReport for the
// exact Target/Achieve/Nominal formulas (confirmed with the business
// 2026-10-12). Bulan/Tahun resolves the default period; Start/End (when
// both given) overrides it with a custom range — e.g. a payroll period
// that crosses a calendar month boundary.
export default async function OutletFullshiftPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; outletId?: string; pramuniagaId?: string; start?: string; end?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "finance:view_ledger")) redirect("/dashboard");

  const now = new Date();
  const sp = await searchParams;
  const year = sp.year ? Number(sp.year) : now.getFullYear();
  const month = sp.month ? Number(sp.month) : now.getMonth() + 1;
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  const { start: monthStart, end: monthEnd } = monthRange(year, month);
  const start = sp.start ? new Date(`${sp.start}T00:00:00.000Z`) : monthStart;
  const end = sp.end ? new Date(`${sp.end}T23:59:59.999Z`) : monthEnd;
  const outletId = sp.outletId || undefined;
  const pramuniagaId = sp.pramuniagaId || undefined;

  const [rows, outlets, pramuniagaUsers] = await Promise.all([
    getFullshiftReport({ start, end, outletId, pramuniagaId }),
    prisma.outlet.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { role: "PRAMUNIAGA", status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const totalAchieve = rows.reduce((s, r) => s + r.jumlahAchieve, 0);
  const totalNominal = rows.reduce((s, r) => s + r.nominalFullshift, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Laporan Fullshift" description="Pencapaian Fullshift per pramuniaga — target tahunan, jumlah hari achieve, dan nominal insentif Rp50.000/hari." />

      <Card>
        <p className="px-5 pt-5 text-sm font-bold text-slate-700">Filter Periode</p>
        <form className="grid grid-cols-2 gap-3 p-5 pt-3 sm:grid-cols-5 sm:items-end">
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
          <div>
            <Label className="text-[11px]">Outlet</Label>
            <Select name="outletId" defaultValue={outletId ?? ""} className="mt-1">
              <option value="">Semua outlet</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label className="text-[11px]">Pramuniaga</Label>
            <Select name="pramuniagaId" defaultValue={pramuniagaId ?? ""} className="mt-1">
              <option value="">Semua pramuniaga</option>
              {pramuniagaUsers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="secondary">
            Terapkan
          </Button>

          <div className="col-span-2 sm:col-span-2">
            <Label className="text-[11px]">Start (opsional — menimpa Bulan/Tahun)</Label>
            <Input type="date" name="start" defaultValue={sp.start ?? ""} className="mt-1" />
          </div>
          <div className="col-span-2 sm:col-span-2">
            <Label className="text-[11px]">End (opsional — menimpa Bulan/Tahun)</Label>
            <Input type="date" name="end" defaultValue={sp.end ?? ""} className="mt-1" />
          </div>
        </form>
        <p className="px-5 pb-4 text-xs text-slate-400">
          Terapkan Bulan/Tahun untuk periode satu bulan kalender; isi Start/End untuk rentang tanggal khusus (mis. periode payroll lintas bulan).
          Mengosongkan Start/End kembali memakai periode Bulan/Tahun. Target Fullshift dihitung untuk tahun {start.getUTCFullYear()} — periode:{" "}
          {toISODate(start)} s/d {toISODate(end)}.
        </p>
      </Card>

      <Card className="p-0" id="fullshift-section">
        <CardHeader>
          <CardTitle>Laporan Fullshift — {toISODate(start)} s/d {toISODate(end)}</CardTitle>
          <ExportExcelButton containerId="fullshift-section" filename={`Laporan_Fullshift_${toISODate(start)}_${toISODate(end)}.xlsx`} />
        </CardHeader>
        <Table data-sheet-name="Fullshift" wrapperClassName="max-h-[75vh] overflow-auto">
          <Thead className="sticky top-0 z-20 bg-slate-50">
            <tr>
              <Th>Nomor</Th>
              <Th>Area</Th>
              <Th>Outlet</Th>
              <Th>Nama Pramuniaga</Th>
              <Th className="text-right">Target Fullshift</Th>
              <Th className="text-right">Jumlah Achieve Fullshift</Th>
              <Th className="text-right">Nominal Fullshift</Th>
            </tr>
          </Thead>
          <tbody>
            {rows.map((r, idx) => (
              <Tr key={`${r.outletId}:${r.pramuniagaKey}`}>
                <Td>{idx + 1}</Td>
                <Td>{r.area}</Td>
                <Td className="font-medium text-slate-900">{r.outletName}</Td>
                <Td>{r.pramuniagaName}</Td>
                <Td className="text-right tabular-nums">{number0.format(r.targetFullshift)}</Td>
                <Td className="text-right font-semibold tabular-nums">{number0.format(r.jumlahAchieve)}</Td>
                <Td className="text-right tabular-nums">{currency.format(r.nominalFullshift)}</Td>
              </Tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={7}>Belum ada data kehadiran/omset pada periode ini.</EmptyRow>}
            {rows.length > 0 && (
              <Tr className="bg-gold-50 font-bold text-brand-900">
                <Td colSpan={5}>TOTAL</Td>
                <Td className="text-right tabular-nums">{number0.format(totalAchieve)}</Td>
                <Td className="text-right tabular-nums">{currency.format(totalNominal)}</Td>
              </Tr>
            )}
          </tbody>
        </Table>
        <p className="px-5 py-3 text-xs text-slate-400">
          Target Fullshift = (target omset tahunan outlet ÷ Target Fullshift Harian) × 75%. Jumlah Achieve Fullshift = jumlah hari pada periode ini omset
          outlet mencapai Target Fullshift Harian, dihitung pada hari pramuniaga tsb hadir/bertugas. Nominal Fullshift = Jumlah Achieve × Rp50.000.
        </p>
      </Card>
    </div>
  );
}
