"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export function CheckpointGrid({ times, completed }: { times: string[]; completed: number[] }) {
  const [done, setDone] = useState(new Set(completed));
  const [pending, startTransition] = useTransition();

  function complete(checkpointNumber: number) {
    startTransition(async () => {
      const res = await fetch("/api/attendance/checkpoint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkpointNumber, status: "OK" }),
      });
      if (res.ok) setDone((prev) => new Set(prev).add(checkpointNumber));
    });
  }

  return (
    <div className="rounded-xl border border-slate-200/70 bg-white p-6 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-brand-900">Checkpoint ({times.length}x/hari)</h2>
        <span className="text-xs font-medium text-slate-400">
          {done.size}/{times.length} selesai
        </span>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6">
        {times.map((time, idx) => {
          const number = idx + 1;
          const isDone = done.has(number);
          return (
            <button
              key={number}
              onClick={() => complete(number)}
              disabled={isDone || pending}
              className={cn(
                "flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
                isDone
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 text-slate-600 hover:border-accent-300 hover:bg-accent-50 hover:text-accent-700",
              )}
            >
              {isDone && <Check className="h-3 w-3" />}
              {time}
            </button>
          );
        })}
      </div>
    </div>
  );
}
