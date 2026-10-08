import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { ExportExcelButton } from "@/components/ui/export-excel-button";
import { Wallet, TrendingUp, TrendingDown } from "lucide-react";
import { getReceivableLedger } from "@/lib/receivable";
import { ReceivableEntryForm } from "@/components/finance/receivable-entry-form";

const MONTH_LABELS_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });

// Buku Pencatatan Piutang — "Historical Account Receivable" (business-
// supplied, 2026-10-08). Detail rows for the selected month, plus a
// per-group summary (Saldo Bulan Lalu/Penambahan/Pembayaran/Saldo Bulan
// Ini) verified to reconcile exactly against the source for Sep-2026.
export default async function ReceivablePage({ searchParams }: { searchParams: Promise<{ year?: string; month?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "finance:view_ledger")) redirect("/dashboard");

  const now = new Date();
  const { year: yearParam, month: monthParam } = await searchParams;
  const year = yearParam ? Number(yearParam) : 2026;
  const month = monthParam ? Number(monthParam) : 9;
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  const { detailRows, groupSummary, total } = await getReceivableLedger(year, month);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Buku Pencatatan Piutang"
        description="Historical Account Receivable — rincian piutang per transaksi dan summary saldo per grup (Outlet/Mitra/Sayur/Kobar/Mangkacau/Tortilla/Mie Steak)."
      />

      <Card>
        <form className="flex flex-wrap items-end gap-3 p-5">
          <div>
            <Label className="text-[11px]">Bulan</Label>
            <Select name="month" defaultValue={String(month)} className="mt-1">
              {MONTH_LABELS_ID.map((m, i) => (
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
        </form>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard label="Saldo Bulan Lalu" value={currency.format(total.saldoBulanLalu)} tone="neutral" icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="Penambahan Piutang" value={currency.format(total.penambahan)} tone="warning" icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Pembayaran Piutang" value={currency.format(total.pembayaran)} tone="success" icon={<TrendingDown className="h-4 w-4" />} />
        <StatCard label="Saldo Bulan Ini" value={currency.format(total.saldoBulanIni)} tone="brand" icon={<Wallet className="h-4 w-4" />} />
      </div>

      <ReceivableEntryForm />

      <Card className="p-0" id="receivable-detail-section">
        <CardHeader className="sticky top-16 z-30 h-14 bg-white">
          <CardTitle>
            Rincian Piutang — {MONTH_LABELS_ID[month - 1]} {year} ({detailRows.length})
          </CardTitle>
          <ExportExcelButton containerId="receivable-detail-section" filename={`Piutang_${MONTH_LABELS_ID[month - 1]}_${year}.xlsx`} />
        </CardHeader>
        <div className="overflow-x-auto" data-sheet-name="Piutang">
          <div className="max-h-[70vh] overflow-y-auto">
            <table className="w-full min-w-[1100px] border-collapse text-xs">
              <thead className="sticky top-0 z-20 bg-slate-50">
                <tr>
                  <th className="border-b border-slate-200 px-2 py-2 text-left font-bold uppercase text-slate-500">Date</th>
                  <th className="border-b border-slate-200 px-2 py-2 text-left font-bold uppercase text-slate-500">Mitra Code</th>
                  <th className="border-b border-slate-200 px-2 py-2 text-left font-bold uppercase text-slate-500">Mitra Name</th>
                  <th className="border-b border-slate-200 px-2 py-2 text-left font-bold uppercase text-slate-500">No. Faktur</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-bold uppercase text-slate-500">Description</th>
                  <th className="border-b border-slate-200 px-2 py-2 text-right font-bold uppercase text-slate-500">Debt</th>
                  <th className="border-b border-slate-200 px-2 py-2 text-right font-bold uppercase text-slate-500">Credit</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-bold uppercase text-slate-500">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {detailRows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 odd:bg-white even:bg-slate-50/60">
                    <td className="px-2 py-1.5 whitespace-nowrap text-slate-600">{dateFormat.format(r.date)}</td>
                    <td className="px-2 py-1.5 text-slate-500">{r.mitraCode}</td>
                    <td className="px-2 py-1.5 font-medium text-slate-900">{r.mitraName}</td>
                    <td className="px-2 py-1.5 text-slate-500">{r.noFaktur ?? "-"}</td>
                    <td className="px-3 py-1.5">{r.description}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{r.debt > 0 ? currency.format(r.debt) : "-"}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{r.credit > 0 ? currency.format(r.credit) : "-"}</td>
                    <td className="px-3 py-1.5 text-slate-500">{r.remarks ?? ""}</td>
                  </tr>
                ))}
                {detailRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-slate-400">
                      Belum ada entri piutang pada periode ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      <Card className="p-0">
        <CardHeader>
          <CardTitle>Summary Saldo Piutang per Grup — {MONTH_LABELS_ID[month - 1]} {year}</CardTitle>
        </CardHeader>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500">
              <th className="border-b border-slate-200 px-4 py-2 text-left">Grup</th>
              <th className="border-b border-slate-200 px-4 py-2 text-right">Saldo Bulan Lalu</th>
              <th className="border-b border-slate-200 px-4 py-2 text-right">Penambahan Piutang</th>
              <th className="border-b border-slate-200 px-4 py-2 text-right">Pembayaran Piutang</th>
              <th className="border-b border-slate-200 px-4 py-2 text-right">Saldo Bulan Ini</th>
            </tr>
          </thead>
          <tbody>
            {groupSummary.map((g) => (
              <tr key={g.group} className="border-b border-slate-100 odd:bg-white even:bg-slate-50/60">
                <td className="px-4 py-2 font-medium text-slate-900">{g.label}</td>
                <td className="px-4 py-2 text-right tabular-nums">{currency.format(g.saldoBulanLalu)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{g.penambahan > 0 ? currency.format(g.penambahan) : "-"}</td>
                <td className="px-4 py-2 text-right tabular-nums">{g.pembayaran > 0 ? `(${currency.format(g.pembayaran)})` : "-"}</td>
                <td className="bg-gold-50/40 px-4 py-2 text-right font-semibold tabular-nums text-brand-900">{currency.format(g.saldoBulanIni)}</td>
              </tr>
            ))}
            <tr className="bg-brand-900 font-bold text-white">
              <td className="px-4 py-2">TOTAL</td>
              <td className="px-4 py-2 text-right tabular-nums">{currency.format(total.saldoBulanLalu)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{currency.format(total.penambahan)}</td>
              <td className="px-4 py-2 text-right tabular-nums">({currency.format(total.pembayaran)})</td>
              <td className="px-4 py-2 text-right tabular-nums">{currency.format(total.saldoBulanIni)}</td>
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  );
}
