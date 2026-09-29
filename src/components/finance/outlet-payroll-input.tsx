"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

// Absen Sheet's Labor Cost / Gaji Pokok — manually entered per pramuniaga
// per month (no wage-rate/HR data model exists to compute them from).
// Gaji Pokok is the full-27-working-day base rate; the Absen Sheet's own
// "Total Salary" column then prorates it by actual days worked
// ((Hari Kerja / 27) × Gaji Pokok) — computed server-side, not here.
// Submitting the same outlet+user+month again replaces the figures (see
// the upsert in the API route), so correcting a typo is just re-entering.
export function OutletPayrollInput({
  outletId,
  userId,
  year,
  month,
  defaultLaborCost,
  defaultBaseSalary,
  recorded,
}: {
  outletId: string;
  userId: string;
  year: number;
  month: number;
  defaultLaborCost: number;
  defaultBaseSalary: number;
  recorded: boolean;
}) {
  const router = useRouter();
  const [laborCost, setLaborCost] = useState(String(defaultLaborCost || ""));
  const [baseSalary, setBaseSalary] = useState(String(defaultBaseSalary || ""));
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    setSaved(false);
    startTransition(async () => {
      const res = await fetch("/api/finance/outlet-payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outletId,
          userId,
          year,
          month,
          laborCost: Number(laborCost) || 0,
          salary: Number(baseSalary) || 0,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
        router.refresh();
      }
    });
  }

  const fieldClass = `w-28 rounded-md border px-2 py-1 text-right text-xs tabular-nums ${
    recorded ? "border-slate-200 bg-white" : "border-amber-300 bg-amber-50"
  }`;

  return (
    <div className="flex items-center justify-end gap-1">
      <input type="number" min="0" value={laborCost} onChange={(e) => setLaborCost(e.target.value)} placeholder="Labor Cost" className={fieldClass} />
      <input
        type="number"
        min="0"
        value={baseSalary}
        onChange={(e) => setBaseSalary(e.target.value)}
        placeholder="Gaji Pokok"
        title="Gaji Pokok — rate penuh 27 hari kerja"
        className={fieldClass}
      />
      <button
        onClick={save}
        disabled={pending}
        title="Simpan Labor Cost & Gaji Pokok"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-accent-600 hover:bg-accent-50 disabled:opacity-30"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      {saved && <span className="text-[10px] font-semibold text-emerald-600">✓</span>}
    </div>
  );
}
