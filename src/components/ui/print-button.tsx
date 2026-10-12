"use client";

import { Printer } from "lucide-react";

// Plain window.print() — the browser's own print dialog, letting the user
// save as PDF or send to a physical printer. No custom print stylesheet
// yet, so it prints the page roughly as shown (acceptable for a pill-tab
// report like this; revisit with @media print rules if a cleaner printed
// layout is needed later).
export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
    >
      <Printer className="h-3.5 w-3.5" /> Cetak
    </button>
  );
}
