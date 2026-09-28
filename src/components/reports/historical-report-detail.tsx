import { Store } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

export type ReportDetail = {
  date: string;
  outletName: string;
  regionName: string;
  team: { name: string; shift: string }[];
  status: string;
  spvNotes: string | null;
  stockLines: { itemName: string; unitPrice: number; ambil: number; sisa: number; terjualSistem: number; laku: number }[];
  materialsByGroup: Record<"DAGING" | "SAYUR" | "SAOS_KEMASAN", { name: string; unit: string; qtyUsed: number }[]>;
  onlineCashless: { gofood: number; grab: number; shopee: number; tiktok: number; qpon: number; cashless: number } | null;
  onlineCashlessManualTotal: number;
  potongan: { qtyKopdes: number; kopdesAmount: number; qtyMbg: number; mbgAmount: number; promoAmount: number; promoNotes: string | null };
  potonganManualTotal: number;
  kasbonList: { name: string; notes: string | null; amount: number }[];
  kasbonTotal: number;
  operationalByCategory: { key: string; label: string; amount: number }[];
  operationalTotal: number;
  rekap: { omset: number; nonTunai: number; potongan: number; expenses: number; summarySetoran: number; kasbonTotal: number; totalFisikCash: number };
  actualCashCounted: number;
  variance: number;
};

function RekapStatCard({ label, value, tone }: { label: string; value: number; tone: "green" | "blue" | "gold" | "red" }) {
  const TONE_CLASSES: Record<string, string> = {
    green: "text-emerald-400",
    blue: "text-sky-400",
    gold: "text-amber-400",
    red: "text-rose-400",
  };
  return (
    <div className="rounded-xl border border-white/10 bg-brand-950 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={cn("mt-1.5 text-lg font-bold", TONE_CLASSES[tone])}>{currency.format(value)}</p>
    </div>
  );
}

// Full read-only replay of one day's Laporan Harian — Informasi Outlet
// through Total Fisik Cash — shared between the pramuniaga's own Riwayat
// Setoran history (fetched lazily on row expand) and SPV's Verifikasi
// Laporan (so a report is inspected in full before being approved/rejected,
// not just judged from a one-line summary).
export function HistoricalReportDetail({ detail }: { detail: ReportDetail }) {
  const dateLabel = new Date(`${detail.date.slice(0, 10)}T00:00:00Z`).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <div className="space-y-4 border-l-4 border-transparent bg-slate-50/50 p-4">
      <Card className="p-5">
        <div className="flex items-center gap-2">
          <Store className="h-4 w-4 text-accent-600" />
          <h3 className="text-sm font-bold text-brand-900">Informasi Outlet</h3>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Pramuniaga Bertugas</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {detail.team.length > 0 ? (
                detail.team.map((t, i) => (
                  <span key={i} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">
                    {t.name} · {t.shift}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-400">-</span>
              )}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Lokasi Outlet</p>
            <p className="font-medium text-slate-800">{detail.outletName}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Hari &amp; Tanggal</p>
            <p className="font-medium text-slate-800">{dateLabel}</p>
          </div>
        </div>
        {detail.spvNotes && (
          <p className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
            <span className="font-bold">Catatan SPV:</span> {detail.spvNotes}
          </p>
        )}
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="rounded-t-xl bg-brand-950 px-5 py-3">
          <p className="text-sm font-bold uppercase tracking-wide text-white">1. Tabel Laporan Harian (Penjualan Bahan Baku / Stok)</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80">
            <tr>
              <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase text-slate-500">Bahan Baku</th>
              <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase text-slate-500">Harga</th>
              <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase text-slate-500">Laku</th>
              <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase text-slate-500">Nominal</th>
            </tr>
          </thead>
          <tbody>
            {detail.stockLines.map((l, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="px-4 py-2 text-slate-700">{l.itemName}</td>
                <td className="px-4 py-2 text-right text-slate-600">{currency.format(l.unitPrice)}</td>
                <td className="px-4 py-2 text-right font-semibold text-slate-800">{l.laku}</td>
                <td className="px-4 py-2 text-right font-semibold text-brand-900">{currency.format(l.laku * l.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {(
          [
            ["DAGING", "Daging"],
            ["SAYUR", "Sayur"],
            ["SAOS_KEMASAN", "Bahan Baku (Saos & Kemasan)"],
          ] as const
        ).map(([key, label]) => (
          <Card key={key} className="p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-brand-900">{label}</p>
            {detail.materialsByGroup[key].length > 0 ? (
              <ul className="space-y-1.5 text-sm">
                {detail.materialsByGroup[key].map((m, i) => (
                  <li key={i} className="flex items-center justify-between text-slate-700">
                    <span>{m.name}</span>
                    <span className="font-semibold">
                      {m.qtyUsed} {m.unit}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400">Tidak ada pemakaian.</p>
            )}
          </Card>
        ))}
      </div>

      {detail.onlineCashless && (
        <Card className="overflow-hidden p-0">
          <div className="rounded-t-xl bg-brand-950 px-5 py-3">
            <p className="text-sm font-bold uppercase tracking-wide text-white">2. Pengeluaran Online &amp; Cashless</p>
          </div>
          <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3">
            {(
              [
                ["GO FOOD", detail.onlineCashless.gofood],
                ["GRAB FOOD", detail.onlineCashless.grab],
                ["SHOPEE FOOD", detail.onlineCashless.shopee],
                ["TIKTOK", detail.onlineCashless.tiktok],
                ["QPON", detail.onlineCashless.qpon],
                ["CASHLESS", detail.onlineCashless.cashless],
              ] as const
            ).map(([label, amount]) => (
              <div key={label}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                <p className="font-semibold text-slate-800">{currency.format(amount)}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-100 bg-amber-400 px-5 py-2.5 text-right text-sm font-bold text-brand-950">
            Total: {currency.format(detail.onlineCashlessManualTotal)}
          </div>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="rounded-t-xl bg-brand-950 px-5 py-3">
          <p className="text-sm font-bold uppercase tracking-wide text-white">3. Potongan Penjualan</p>
        </div>
        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Kopdes ({detail.potongan.qtyKopdes} menu)</p>
            <p className="font-semibold text-slate-800">{currency.format(detail.potongan.kopdesAmount)}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">MBG ({detail.potongan.qtyMbg} menu)</p>
            <p className="font-semibold text-slate-800">{currency.format(detail.potongan.mbgAmount)}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Promo {detail.potongan.promoNotes ? `(${detail.potongan.promoNotes})` : ""}</p>
            <p className="font-semibold text-slate-800">{currency.format(detail.potongan.promoAmount)}</p>
          </div>
        </div>
        <div className="border-t border-slate-100 bg-amber-400 px-5 py-2.5 text-right text-sm font-bold text-brand-950">
          Total: {currency.format(detail.potonganManualTotal)}
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="rounded-t-xl bg-brand-950 px-5 py-3">
          <p className="text-sm font-bold uppercase tracking-wide text-white">4. Kasbon</p>
        </div>
        {detail.kasbonList.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {detail.kasbonList.map((k, i) => (
              <li key={i} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <span className="font-medium text-slate-800">{k.name}</span>
                <span className="text-slate-500">{k.notes ?? "-"}</span>
                <span className="font-semibold text-slate-800">{currency.format(k.amount)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-6 text-center text-sm text-slate-400">Tidak ada kasbon hari ini.</p>
        )}
        <div className="border-t border-slate-100 bg-amber-400 px-5 py-2.5 text-right text-sm font-bold text-brand-950">
          Total: {currency.format(detail.kasbonTotal)}
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="rounded-t-xl bg-brand-950 px-5 py-3">
          <p className="text-sm font-bold uppercase tracking-wide text-white">5. Pengeluaran Operasional Outlet</p>
        </div>
        {detail.operationalByCategory.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {detail.operationalByCategory.map((c) => (
              <li key={c.key} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <span className="font-medium text-slate-800">{c.label}</span>
                <span className="font-semibold text-slate-800">{currency.format(c.amount)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-6 text-center text-sm text-slate-400">Tidak ada pengeluaran operasional.</p>
        )}
        <div className="border-t border-slate-100 bg-amber-400 px-5 py-2.5 text-right text-sm font-bold text-brand-950">
          Total: {currency.format(detail.operationalTotal)}
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="rounded-t-xl bg-brand-950 px-5 py-3">
          <p className="text-sm font-bold uppercase tracking-wide text-white">Rekap Summary Setoran Shift</p>
        </div>
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <RekapStatCard label="Total Omset Penjualan" value={detail.rekap.omset} tone="green" />
          <RekapStatCard label="(-) Total Online & Cashless" value={detail.rekap.nonTunai} tone="blue" />
          <RekapStatCard label="(-) Total Potongan Penjualan" value={detail.rekap.potongan} tone="gold" />
          <RekapStatCard label="(-) Total Operasional Outlet" value={detail.rekap.expenses} tone="red" />
        </div>
        <div className="mx-5 mb-5 rounded-xl border border-amber-300 bg-amber-400 p-5 text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-950">Total Fisik Uang Tunai (Cash) Wajib Disetor</p>
          <p className="mt-1.5 text-3xl font-bold text-brand-950">{currency.format(detail.rekap.totalFisikCash)}</p>
          <p className="mt-1.5 text-[11px] font-medium text-brand-900">
            Actual Cash Counted saat itu: {currency.format(detail.actualCashCounted)} · Variance: {currency.format(detail.variance)}
          </p>
        </div>
      </Card>
    </div>
  );
}
