import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { BukuKasHeaderData } from "@/lib/buku-kas-header";

const MONTH_LABELS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const COMPANY_NAME = "PT. Berkah Purnama Sewu";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const number2 = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function BalanceCell({ value }: { value: number }) {
  // Matches the business's own ledger-sheet convention: a credit/outflow
  // shows in parentheses rather than with a minus sign.
  return <span className={value < 0 ? "text-rose-600" : ""}>{value < 0 ? `(${number2.format(Math.abs(value))})` : number2.format(value)}</span>;
}

// The business's own Excel ledger-sheet header (Nama Buku / Periode /
// Officer / Saldo Awal / Company, plus a Begining-DB-CR-Ending balance
// table for day 1 of the period vs the whole period), reused on both
// the dedicated Buku Kas report page and inline on the Jurnal page.
export function BukuKasHeaderCard({ data, month, year }: { data: BukuKasHeaderData; month: number; year: number }) {
  const yyyymm = `${year}${String(month).padStart(2, "0")}`;

  return (
    <Card className="overflow-hidden border-2 border-slate-900 p-0">
      <div className="grid lg:grid-cols-[1.6fr_1fr]">
        <div className="divide-y divide-slate-900/20">
          <div className="grid grid-cols-[110px_1fr] items-stretch">
            <span className="flex items-center bg-[#dbe3b4] px-3 py-2 text-xs font-bold italic text-slate-900">Nama Buku</span>
            <span className="flex items-center gap-2 bg-[#1f3864] px-3 py-2">
              <span className="text-sm font-bold italic text-[#ffd966]">{data.account.name}</span>
              <span className="rounded bg-[#b8cce4] px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-900">{data.account.code}</span>
            </span>
          </div>
          <div className="grid grid-cols-[110px_1fr] items-stretch">
            <span className="flex items-center bg-[#dbe3b4] px-3 py-2 text-xs font-bold italic text-slate-900">Periode</span>
            <span className="flex items-center gap-2 bg-white px-3 py-2">
              <span className="rounded bg-[#b8cce4] px-2 py-0.5 text-xs font-semibold text-slate-900">{month}</span>
              <span className="rounded bg-[#b8cce4] px-2 py-0.5 text-xs font-semibold text-slate-900">{year}</span>
              <span className="text-sm font-bold italic text-rose-600">{MONTH_LABELS_ID[month - 1]} {year}</span>
            </span>
          </div>
          <div className="grid grid-cols-[110px_1fr] items-stretch">
            <span className="flex items-center bg-[#dbe3b4] px-3 py-2 text-xs font-bold italic text-slate-900">Officer</span>
            <span className="flex items-center bg-white px-3 py-2">
              {data.officerName ? (
                <span className="text-sm font-bold italic text-rose-600">{data.officerName}</span>
              ) : (
                <span className="text-xs text-slate-400">
                  Belum diatur —{" "}
                  <Link href="/admin/settings" className="font-semibold text-accent-700 hover:text-accent-800">
                    atur di Admin &gt; Settings
                  </Link>
                </span>
              )}
            </span>
          </div>
          <div className="grid grid-cols-[110px_1fr] items-stretch">
            <span className="flex items-center bg-[#dbe3b4] px-3 py-2 text-xs font-bold italic text-slate-900">Saldo Awal</span>
            <span className="flex items-center bg-[#f2dcdb] px-3 py-2 text-sm font-bold text-slate-900">{currency.format(data.saldoAwal)}</span>
          </div>
          <div className="grid grid-cols-[110px_1fr] items-stretch">
            <span className="flex items-center bg-[#dbe3b4] px-3 py-2 text-xs font-bold italic text-slate-900">Company</span>
            <span className="flex items-center bg-white px-3 py-2 text-sm font-bold text-rose-600">{COMPANY_NAME}</span>
          </div>
        </div>

        <div className="border-t-2 border-slate-900 lg:border-l-2 lg:border-t-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#8fa968] text-white">
                <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide">Balance</th>
                <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wide">1</th>
                <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wide">{yyyymm}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/10">
              <tr>
                <td className="bg-[#dbe3b4] px-3 py-2 font-bold italic text-slate-900">Begining</td>
                <td className="bg-white px-3 py-2 text-right tabular-nums">
                  <BalanceCell value={data.saldoAwal} />
                </td>
                <td className="bg-white px-3 py-2 text-right tabular-nums">
                  <BalanceCell value={data.saldoAwal} />
                </td>
              </tr>
              <tr>
                <td className="bg-[#dbe3b4] px-3 py-2 font-bold italic text-slate-900">DB</td>
                <td className="bg-white px-3 py-2 text-right tabular-nums">
                  <BalanceCell value={data.db1} />
                </td>
                <td className="bg-white px-3 py-2 text-right tabular-nums">
                  <BalanceCell value={data.dbMonth} />
                </td>
              </tr>
              <tr>
                <td className="bg-[#dbe3b4] px-3 py-2 font-bold italic text-slate-900">CR</td>
                <td className="bg-white px-3 py-2 text-right tabular-nums">
                  <BalanceCell value={-data.cr1} />
                </td>
                <td className="bg-white px-3 py-2 text-right tabular-nums">
                  <BalanceCell value={-data.crMonth} />
                </td>
              </tr>
              <tr className="bg-[#c4d79b] font-bold text-slate-900">
                <td className="px-3 py-2 italic">Ending</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  <BalanceCell value={data.endingDay1} />
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  <BalanceCell value={data.endingMonth} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
