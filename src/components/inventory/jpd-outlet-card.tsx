import { Card } from "@/components/ui/card";

const numberFormat = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });
const jpdFormat = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function JpdOutletCard({
  totalProdukKetul,
  pemakaianDaging,
  jpd,
  dateLabel,
}: {
  totalProdukKetul: number;
  pemakaianDaging: number;
  jpd: number;
  dateLabel: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-brand-900">JPD Bulan Berjalan</p>
          <p className="mt-0.5 text-sm text-slate-500">Akumulasi dari tanggal 1 sampai {dateLabel}.</p>
        </div>
        <div className="rounded-xl bg-emerald-50 px-4 py-2 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">JPD</p>
          <p className="text-xl font-bold tabular-nums text-emerald-700">{jpdFormat.format(jpd)}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Total Produk Memakai Daging Ketul</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-brand-900">{numberFormat.format(totalProdukKetul)}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Pemakaian Daging</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-brand-900">{numberFormat.format(pemakaianDaging)}</p>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-slate-400">
        Total produk ÷ (Daging 4kg + Daging 2kg × 0,5). Perhitungan direset setiap awal bulan.
      </p>
    </Card>
  );
}
