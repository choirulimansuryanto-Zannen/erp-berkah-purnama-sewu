"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const CASH_BOOK_LABELS: Record<string, string> = {
  KASIR: "Kasir",
  BRANKAS: "Brankas",
  OUTLET: "Kas Outlet",
  PETTY_CASH: "Petty Cash",
  BANK_BCA: "Bank BCA",
  BANK_MANDIRI: "Bank Mandiri",
};
const BULAN_NAMES_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export type ImportBatchRow = {
  id: string;
  cashBook: string;
  fileName: string | null;
  targetYear: number;
  targetMonth: number;
  rowCount: number;
  totalDebitRows: number;
  totalCreditRows: number;
  createdAt: string;
  createdByName: string;
};

// Undo for a PAST import (not just the one just completed in this
// session) — in case someone notices a wrong period/buku kas was picked
// after navigating away or reloading. Deletes every entry the batch
// created, same as the just-posted "Batalkan Import Ini" button.
export function JournalImportHistory({ batches }: { batches: ImportBatchRow[] }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function deleteBatch(batch: ImportBatchRow) {
    const label = `${CASH_BOOK_LABELS[batch.cashBook] ?? batch.cashBook} — ${BULAN_NAMES_ID[batch.targetMonth - 1]} ${batch.targetYear} (${batch.rowCount} jurnal)`;
    if (!window.confirm(`Hapus semua jurnal dari import ini?\n\n${label}\n\nTindakan ini tidak bisa dibatalkan.`)) return;
    setError(null);
    setDeletingId(batch.id);
    try {
      const res = await fetch(`/api/finance/journal-import/${batch.id}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Gagal menghapus batch import.");
      }
    } catch {
      setError("Gagal menghapus batch import.");
    } finally {
      setDeletingId(null);
    }
  }

  if (batches.length === 0) {
    return <p className="text-xs text-slate-400">Belum ada riwayat import.</p>;
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
      <div className="overflow-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[700px] border-collapse text-xs">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-2 py-1.5 text-left font-semibold text-slate-500">Diimpor</th>
              <th className="px-2 py-1.5 text-left font-semibold text-slate-500">Buku Kas</th>
              <th className="px-2 py-1.5 text-left font-semibold text-slate-500">Periode</th>
              <th className="px-2 py-1.5 text-left font-semibold text-slate-500">File</th>
              <th className="px-2 py-1.5 text-right font-semibold text-slate-500">Jumlah</th>
              <th className="px-2 py-1.5 text-left font-semibold text-slate-500">Oleh</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id} className="border-t border-slate-100">
                <td className="px-2 py-1.5 text-slate-500">{new Date(b.createdAt).toLocaleString("id-ID")}</td>
                <td className="px-2 py-1.5 font-medium text-slate-800">{CASH_BOOK_LABELS[b.cashBook] ?? b.cashBook}</td>
                <td className="px-2 py-1.5">{BULAN_NAMES_ID[b.targetMonth - 1]} {b.targetYear}</td>
                <td className="max-w-[160px] truncate px-2 py-1.5 text-slate-500" title={b.fileName ?? ""}>{b.fileName ?? "—"}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{b.rowCount} baris</td>
                <td className="px-2 py-1.5 text-slate-500">{b.createdByName}</td>
                <td className="px-2 py-1.5">
                  <button
                    onClick={() => deleteBatch(b)}
                    disabled={deletingId === b.id}
                    title="Batalkan import ini (hapus semua jurnalnya)"
                    className="flex items-center gap-1 rounded-md border border-rose-200 px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-3 w-3" /> {deletingId === b.id ? "..." : "Batalkan"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
