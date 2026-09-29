"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

// Shared trigger for both Laporan Insentif and Laporan Sharing Profit —
// both are "computed and locked until recalculated" the same way
// (src/lib/incentive.ts), so re-running for the same month just replaces
// its rows rather than erroring or duplicating.
export function RunCalculationButton({ endpoint, year, month }: { endpoint: string; year: number; month: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month }),
      });
      if (res.ok) router.refresh();
      else window.alert("Gagal menghitung — periksa rate/investor sudah diisi.");
    });
  }

  return (
    <Button onClick={run} disabled={pending} variant="secondary">
      <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
      {pending ? "Menghitung..." : "Hitung Ulang Bulan Ini"}
    </Button>
  );
}
