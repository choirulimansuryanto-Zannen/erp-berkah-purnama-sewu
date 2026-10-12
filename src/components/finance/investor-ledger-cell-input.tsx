"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, LockOpen, Check } from "lucide-react";

// Adj./Accum./Transfer-Shared editing for one investor's ONE specific
// month on the Rekap Akumulasi Profit & Loss table — only rendered when a
// specific Bulan is selected (not "Semua bulan", where there's no single
// month's cell to lock). Adj. is a plain always-editable figure; Accum.
// and Transfer/Shared are "kosongkan untuk pakai hitungan, isi untuk
// mengunci" locks — the lock icon toggles between showing the computed
// value (muted, not editable) and an editable override input.
export function InvestorLedgerCellInput({
  investorId,
  year,
  month,
  defaultAdj,
  defaultAccum,
  defaultAccumIsOverride,
  defaultTransferShared,
  defaultTransferSharedIsOverride,
}: {
  investorId: string;
  year: number;
  month: number;
  defaultAdj: number;
  defaultAccum: number;
  defaultAccumIsOverride: boolean;
  defaultTransferShared: number;
  defaultTransferSharedIsOverride: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [adj, setAdj] = useState(String(defaultAdj || 0));
  const [accumLocked, setAccumLocked] = useState(defaultAccumIsOverride);
  const [accumValue, setAccumValue] = useState(String(defaultAccum || 0));
  const [transferLocked, setTransferLocked] = useState(defaultTransferSharedIsOverride);
  const [transferValue, setTransferValue] = useState(String(defaultTransferShared || 0));
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await fetch("/api/finance/outlet-investor/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investorId,
          year,
          month,
          adj: Number(adj) || 0,
          accumOverride: accumLocked ? Number(accumValue) || 0 : null,
          transferSharedOverride: transferLocked ? Number(transferValue) || 0 : null,
        }),
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      }
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-[10px] font-semibold text-accent-700 hover:text-accent-800" title="Edit Adj. / kunci Accum. & Transfer-Shared">
        Edit
      </button>
    );
  }

  const fieldClass = "w-28 rounded-md border border-slate-300 px-2 py-1 text-right text-xs tabular-nums";
  return (
    <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-left">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[10px] font-semibold uppercase text-slate-500">Adj.</label>
        <input type="number" step="any" value={adj} onChange={(e) => setAdj(e.target.value)} className={fieldClass} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <label className="text-[10px] font-semibold uppercase text-slate-500">Accum.</label>
        <div className="flex items-center gap-1">
          {accumLocked ? (
            <input type="number" step="any" value={accumValue} onChange={(e) => setAccumValue(e.target.value)} className={fieldClass} />
          ) : (
            <span className="w-28 text-right text-xs italic text-slate-400">otomatis</span>
          )}
          <button onClick={() => setAccumLocked((v) => !v)} title={accumLocked ? "Buka kunci — pakai hitungan" : "Kunci angka ini"} className="text-slate-500 hover:text-slate-700">
            {accumLocked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <label className="text-[10px] font-semibold uppercase text-slate-500">Transfer/Shared</label>
        <div className="flex items-center gap-1">
          {transferLocked ? (
            <input type="number" step="any" value={transferValue} onChange={(e) => setTransferValue(e.target.value)} className={fieldClass} />
          ) : (
            <span className="w-28 text-right text-xs italic text-slate-400">otomatis</span>
          )}
          <button
            onClick={() => setTransferLocked((v) => !v)}
            title={transferLocked ? "Buka kunci — pakai hitungan" : "Kunci angka ini"}
            className="text-slate-500 hover:text-slate-700"
          >
            {transferLocked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button onClick={save} disabled={pending} className="flex items-center gap-1 rounded-md bg-brand-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800 disabled:opacity-50">
          <Check className="h-3.5 w-3.5" /> Simpan
        </button>
        <button onClick={() => setOpen(false)} className="text-xs text-slate-500 hover:text-slate-700">
          Batal
        </button>
      </div>
    </div>
  );
}
