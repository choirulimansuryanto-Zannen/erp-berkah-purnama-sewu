"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

// Summary Gaji & Tunjangan panel's 3 yellow editable cells per row — Total
// Absen (overrides the automatic days-in-month figure), Salary ("Gaji
// Pokok" — shares the same OutletPayroll.salary field the Absen Sheet's
// own OutletPayrollInput writes to, so editing it here keeps both panels
// in sync), and Ref (the Share Value weight). Labor Cost stays read-only
// here — it's still edited from the Absen Sheet (OutletPayrollInput).
export function GajiTunjanganRowInput({
  outletId,
  userId,
  year,
  month,
  defaultLaborCost,
  defaultTotalAbsen,
  defaultSalary,
  defaultRef,
}: {
  outletId: string;
  userId: string;
  year: number;
  month: number;
  defaultLaborCost: number;
  defaultTotalAbsen: number;
  defaultSalary: number;
  defaultRef: number;
}) {
  const router = useRouter();
  const [totalAbsen, setTotalAbsen] = useState(String(defaultTotalAbsen || ""));
  const [salary, setSalary] = useState(String(defaultSalary || ""));
  const [ref, setRef] = useState(String(defaultRef ?? 1));
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
          laborCost: defaultLaborCost,
          salary: Number(salary) || 0,
          totalAbsenOverride: Number(totalAbsen) || 0,
          refMultiplier: Number(ref) || 1,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
        router.refresh();
      }
    });
  }

  const fieldClass = "rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-center text-xs font-semibold tabular-nums focus:outline-none focus:ring-1 focus:ring-brand-500";

  return (
    <div className="flex items-center gap-1">
      <input type="number" min="0" max="31" value={totalAbsen} onChange={(e) => setTotalAbsen(e.target.value)} onBlur={save} title="Total Absen" className={`${fieldClass} w-14`} />
      <input type="number" min="0" value={salary} onChange={(e) => setSalary(e.target.value)} onBlur={save} title="Salary (Gaji Pokok)" className={`${fieldClass} w-24`} />
      <input type="number" min="0" step="0.1" value={ref} onChange={(e) => setRef(e.target.value)} onBlur={save} title="Ref — pengali Share Value" className={`${fieldClass} w-12`} />
      {pending && <span className="text-[10px] text-slate-400">...</span>}
      {saved && <Check className="h-3.5 w-3.5 text-emerald-600" />}
    </div>
  );
}
