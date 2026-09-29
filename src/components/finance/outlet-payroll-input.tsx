"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

// Absen Sheet's Labor Cost / Salary — manually entered per pramuniaga per
// month (no wage-rate/HR data model exists to compute them from).
// Submitting the same outlet+user+month again replaces the figures (see
// the upsert in the API route), so correcting a typo is just re-entering.
export function OutletPayrollInput({
  outletId,
  userId,
  year,
  month,
  defaultLaborCost,
  defaultSalary,
  recorded,
}: {
  outletId: string;
  userId: string;
  year: number;
  month: number;
  defaultLaborCost: number;
  defaultSalary: number;
  recorded: boolean;
}) {
  const router = useRouter();
  const [laborCost, setLaborCost] = useState(String(defaultLaborCost || ""));
  const [salary, setSalary] = useState(String(defaultSalary || ""));
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
          salary: Number(salary) || 0,
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
      <input type="number" min="0" value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="Salary" className={fieldClass} />
      <button
        onClick={save}
        disabled={pending}
        title="Simpan Labor Cost & Salary"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-accent-600 hover:bg-accent-50 disabled:opacity-30"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      {saved && <span className="text-[10px] font-semibold text-emerald-600">✓</span>}
    </div>
  );
}
