"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil } from "lucide-react";

// The 4 flat BIAYA figures with no computed source yet (Tunjangan Outlet,
// Gaji Pengelola, Fullshift, Insentive Operator placeholder) — entered
// once per outlet/month, same upsert-per-period convention as every other
// manual monthly figure in this app. Shown read-only with an inline edit
// toggle rather than always-open inputs, since these change rarely
// (unlike the per-pramuniaga cells, which are routine monthly entries).
export function OutletMonthlyBenefitInput({
  outletId,
  year,
  month,
  defaultTunjanganOutlet,
  defaultGajiPengelola,
  defaultFullshiftAmount,
  defaultInsentiveOperatorAmount,
}: {
  outletId: string;
  year: number;
  month: number;
  defaultTunjanganOutlet: number;
  defaultGajiPengelola: number;
  defaultFullshiftAmount: number;
  defaultInsentiveOperatorAmount: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [tunjanganOutlet, setTunjanganOutlet] = useState(String(defaultTunjanganOutlet || 0));
  const [gajiPengelola, setGajiPengelola] = useState(String(defaultGajiPengelola || 0));
  const [fullshiftAmount, setFullshiftAmount] = useState(String(defaultFullshiftAmount || 0));
  const [insentiveOperatorAmount, setInsentiveOperatorAmount] = useState(String(defaultInsentiveOperatorAmount || 0));
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await fetch("/api/finance/outlet-monthly-benefit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outletId,
          year,
          month,
          tunjanganOutlet: Number(tunjanganOutlet) || 0,
          gajiPengelola: Number(gajiPengelola) || 0,
          fullshiftAmount: Number(fullshiftAmount) || 0,
          insentiveOperatorAmount: Number(insentiveOperatorAmount) || 0,
        }),
      });
      if (res.ok) {
        setEditing(false);
        router.refresh();
      }
    });
  }

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-700 hover:text-accent-800">
        <Pencil className="h-3 w-3" /> Edit Tunjangan Outlet / Gaji Pengelola / Fullshift / Insentive Operator
      </button>
    );
  }

  const fieldClass = "w-full rounded-md border border-slate-300 px-2 py-1 text-right text-xs tabular-nums";
  return (
    <div className="grid grid-cols-2 gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 sm:grid-cols-4">
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">Tunjangan Outlet</label>
        <input type="number" min="0" value={tunjanganOutlet} onChange={(e) => setTunjanganOutlet(e.target.value)} className={fieldClass} />
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">Gaji Pengelola</label>
        <input type="number" min="0" value={gajiPengelola} onChange={(e) => setGajiPengelola(e.target.value)} className={fieldClass} />
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">Fullshift</label>
        <input type="number" min="0" value={fullshiftAmount} onChange={(e) => setFullshiftAmount(e.target.value)} className={fieldClass} />
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">Insentive Operator</label>
        <input type="number" min="0" value={insentiveOperatorAmount} onChange={(e) => setInsentiveOperatorAmount(e.target.value)} className={fieldClass} />
      </div>
      <div className="col-span-2 flex items-center gap-2 sm:col-span-4">
        <button onClick={save} disabled={pending} className="flex items-center gap-1 rounded-md bg-brand-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800 disabled:opacity-50">
          <Check className="h-3.5 w-3.5" /> Simpan
        </button>
        <button onClick={() => setEditing(false)} className="text-xs text-slate-500 hover:text-slate-700">
          Batal
        </button>
      </div>
    </div>
  );
}
