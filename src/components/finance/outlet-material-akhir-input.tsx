"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

// Inline stock-opname input for one material's "Akhir" (Saldo Akhir) qty on
// the Inventory Sheet — the one manually-entered figure in that sheet;
// everything else (Awal, Masuk, Rusak/Reject/Selisih, and the Pakai plug)
// is derived. Submitting the same outlet+material+month again replaces the
// previous figure (see the upsert in the API route).
export function OutletMaterialAkhirInput({
  outletId,
  materialId,
  year,
  month,
  defaultValue,
  recorded,
}: {
  outletId: string;
  materialId: string;
  year: number;
  month: number;
  defaultValue: number;
  recorded: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(String(defaultValue));
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    setSaved(false);
    startTransition(async () => {
      const res = await fetch("/api/finance/outlet-material-closing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outletId, materialId, year, month, qty: Number(value) || 0 }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={`w-20 rounded-md border px-2 py-1 text-right text-xs tabular-nums ${
          recorded ? "border-slate-200 bg-white" : "border-amber-300 bg-amber-50"
        }`}
        title={recorded ? "Sudah di-opname" : "Belum di-opname — memakai nilai perhitungan (plug)"}
      />
      <button
        onClick={save}
        disabled={pending}
        title="Simpan hasil opname"
        className="flex h-6 w-6 items-center justify-center rounded-md text-accent-600 hover:bg-accent-50 disabled:opacity-30"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      {saved && <span className="text-[10px] font-semibold text-emerald-600">✓</span>}
    </div>
  );
}
