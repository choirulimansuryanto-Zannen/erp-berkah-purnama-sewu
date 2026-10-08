import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { ExportExcelButton } from "@/components/ui/export-excel-button";
import { Wallet, TrendingDown, Banknote } from "lucide-react";
import { getVendorLedgers } from "@/lib/vendor-ledger";
import { VendorLedgerEntryForm } from "@/components/finance/vendor-ledger-entry-form";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

// Buku Hutang Vendor — one running ledger per vendor (business-supplied
// template, 2026-10-08): Date / Hutang / Bayar / Debet / Kredit / Remarks,
// with a running Saldo per vendor. Positioned above Fixed Asset.
export default async function VendorPayablePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "finance:view_ledger")) redirect("/dashboard");

  const [ledgers, vendors] = await Promise.all([
    getVendorLedgers(),
    prisma.vendor.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  const grandSaldo = ledgers.reduce((s, l) => s + l.saldoAkhir, 0);
  const grandHutang = ledgers.reduce((s, l) => s + l.totalHutang, 0);
  const grandBayar = ledgers.reduce((s, l) => s + l.totalBayar, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Buku Hutang Vendor"
        description="Kartu hutang per vendor — Hutang (bertambah) / Bayar (berkurang), dengan saldo berjalan. Kelola daftar vendor di menu Admin → Vendor."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Hutang Tercatat" value={currency.format(grandHutang)} tone="warning" icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="Total Dibayar" value={currency.format(grandBayar)} tone="success" icon={<TrendingDown className="h-4 w-4" />} />
        <StatCard label="Saldo Hutang (seluruh vendor)" value={currency.format(grandSaldo)} tone="brand" icon={<Banknote className="h-4 w-4" />} />
      </div>

      <VendorLedgerEntryForm vendors={vendors} />

      <div id="vendor-payable-section" className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {ledgers.map((l) => (
          <Card key={l.id} className="p-0">
            <CardHeader className="h-12">
              <CardTitle className="text-sm">{l.name}</CardTitle>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${l.saldoAkhir > 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                {currency.format(l.saldoAkhir)}
              </span>
            </CardHeader>
            <div className="max-h-[320px] overflow-y-auto">
              <table className="w-full border-collapse text-[11px]">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <th className="border-b border-slate-200 px-2 py-1.5 text-left font-semibold text-slate-500">Tanggal</th>
                    <th className="border-b border-slate-200 px-2 py-1.5 text-right font-semibold text-slate-500">Debet</th>
                    <th className="border-b border-slate-200 px-2 py-1.5 text-right font-semibold text-slate-500">Kredit</th>
                    <th className="border-b border-slate-200 px-2 py-1.5 text-left font-semibold text-slate-500">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {l.rows.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="px-2 py-1.5 tabular-nums text-slate-600">{dateFormat.format(r.date)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{r.debet > 0 ? currency.format(r.debet) : "-"}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{r.kredit > 0 ? currency.format(r.kredit) : "-"}</td>
                      <td className="px-2 py-1.5 text-slate-500">{r.remarks ?? ""}</td>
                    </tr>
                  ))}
                  {l.rows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-2 py-4 text-center text-slate-400">
                        Belum ada entri.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-brand-900">
                    <td className="px-2 py-1.5">Saldo</td>
                    <td colSpan={3} className="px-2 py-1.5 text-right">
                      {currency.format(l.saldoAkhir)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        ))}
        {ledgers.length === 0 && (
          <Card className="p-6 text-center text-sm text-slate-400 lg:col-span-2 xl:col-span-3">
            Belum ada vendor — tambahkan di menu Admin → Vendor.
          </Card>
        )}
      </div>
      <div className="flex justify-end">
        <ExportExcelButton containerId="vendor-payable-section" filename="Buku_Hutang_Vendor.xlsx" />
      </div>
    </div>
  );
}
