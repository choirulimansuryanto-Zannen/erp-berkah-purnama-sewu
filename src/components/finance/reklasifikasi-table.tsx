"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { CASH_BOOK_LABELS } from "@/lib/accounting-labels";
import { cn } from "@/lib/cn";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

export type ReklasifikasiRow = {
  lineId: string;
  entryNumber: string;
  date: string;
  cashBook: string;
  description: string;
  amount: number;
  isDebitSide: boolean;
};

export type AccountOption = { id: string; code: string; name: string };

// One row per JournalEntryLine still pointing at its Buku Kas's
// Transitory account — pick the real account and Simpan reassigns that
// line in place (PATCH /api/finance/journal/reclassify/[lineId]). A
// saved row is disabled immediately and router.refresh() then drops it
// from the list entirely (it no longer matches the Transitory filter
// the server page queried with).
export function ReklasifikasiTable({ rows, accounts }: { rows: ReklasifikasiRow[]; accounts: AccountOption[] }) {
  const router = useRouter();
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [errorByRow, setErrorByRow] = useState<Record<string, string>>({});

  async function save(lineId: string) {
    const accountId = selections[lineId];
    if (!accountId) return;
    setSavingId(lineId);
    setErrorByRow((prev) => ({ ...prev, [lineId]: "" }));
    try {
      const res = await fetch(`/api/finance/journal/reclassify/${lineId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      const data = await res.json();
      if (res.ok) {
        setSavedIds((prev) => new Set(prev).add(lineId));
        router.refresh();
      } else {
        setErrorByRow((prev) => ({ ...prev, [lineId]: typeof data.error === "string" ? data.error : "Gagal menyimpan." }));
      }
    } catch {
      setErrorByRow((prev) => ({ ...prev, [lineId]: "Gagal menyimpan." }));
    } finally {
      setSavingId(null);
    }
  }

  if (rows.length === 0) {
    return <p className="p-5 text-sm text-slate-400">Tidak ada transaksi yang masih menunggu reklasifikasi.</p>;
  }

  return (
    <div className="overflow-auto">
      <table className="w-full min-w-[960px] border-collapse text-xs">
        <thead className="sticky top-0 bg-slate-50">
          <tr>
            <th className="px-2 py-2 text-left font-semibold text-slate-500">Tanggal</th>
            <th className="px-2 py-2 text-left font-semibold text-slate-500">No. Jurnal</th>
            <th className="px-2 py-2 text-left font-semibold text-slate-500">Buku Kas</th>
            <th className="px-2 py-2 text-left font-semibold text-slate-500">Keterangan</th>
            <th className="px-2 py-2 text-right font-semibold text-slate-500">Nominal</th>
            <th className="px-2 py-2 text-left font-semibold text-slate-500">Akun Pengganti</th>
            <th className="px-2 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const saved = savedIds.has(r.lineId);
            return (
              <tr key={r.lineId} className={cn("border-t border-slate-100", saved && "bg-emerald-50/50")}>
                <td className="px-2 py-1.5 whitespace-nowrap text-slate-500">{new Date(r.date).toLocaleDateString("id-ID")}</td>
                <td className="px-2 py-1.5 whitespace-nowrap text-slate-500">{r.entryNumber}</td>
                <td className="px-2 py-1.5 whitespace-nowrap font-medium text-slate-800">{CASH_BOOK_LABELS[r.cashBook as keyof typeof CASH_BOOK_LABELS] ?? r.cashBook}</td>
                <td className="max-w-[260px] truncate px-2 py-1.5" title={r.description}>
                  {r.description}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
                  {r.isDebitSide ? "Debit" : "Kredit"} {currency.format(r.amount)}
                </td>
                <td className="px-2 py-1.5">
                  <select
                    value={selections[r.lineId] ?? ""}
                    onChange={(e) => setSelections((prev) => ({ ...prev, [r.lineId]: e.target.value }))}
                    disabled={saved}
                    className="w-full min-w-[240px] rounded-md border border-slate-300 bg-white px-2 py-1 text-xs disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="">— pilih akun —</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        [{a.code}] {a.name}
                      </option>
                    ))}
                  </select>
                  {errorByRow[r.lineId] && <p className="mt-1 text-[10px] font-semibold text-rose-600">{errorByRow[r.lineId]}</p>}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5">
                  {saved ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                      <Check className="h-3.5 w-3.5" /> Tersimpan
                    </span>
                  ) : (
                    <button
                      onClick={() => save(r.lineId)}
                      disabled={!selections[r.lineId] || savingId === r.lineId}
                      className="rounded-md border border-accent-300 bg-white px-2 py-1 text-[11px] font-semibold text-accent-700 hover:bg-accent-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {savingId === r.lineId ? "..." : "Simpan"}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
