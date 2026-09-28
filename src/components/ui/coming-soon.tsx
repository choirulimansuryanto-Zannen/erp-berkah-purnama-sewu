import type { ReactNode } from "react";
import { Construction } from "lucide-react";
import { Card } from "@/components/ui/card";

export function ComingSoon({
  title,
  description,
  plannedFeatures,
  icon,
}: {
  title: string;
  description: string;
  plannedFeatures: string[];
  icon?: ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-br from-brand-950 via-brand-900 to-accent-900 px-6 py-10 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white">
          {icon ?? <Construction className="h-7 w-7" />}
        </div>
        <h2 className="mt-4 text-lg font-bold text-white">{title}</h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-white/70">{description}</p>
      </div>
      <div className="p-6">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Sedang disiapkan</p>
        <ul className="space-y-2.5">
          {plannedFeatures.map((f, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-700">
                {i + 1}
              </span>
              {f}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
