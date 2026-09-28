import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Props = {
  label: string;
  value: string;
  icon: ReactNode;
  variant?: "hero" | "dark";
  subtitle?: string;
  children?: ReactNode;
  className?: string;
};

export function HeroStatCard({ label, value, icon, variant = "dark", subtitle, children, className }: Props) {
  const isHero = variant === "hero";
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl p-5 shadow-lg transition-transform duration-200 hover:-translate-y-0.5",
        isHero ? "bg-gradient-to-br from-accent-500 via-accent-600 to-accent-700 shadow-accent-600/25" : "bg-brand-950 shadow-black/20",
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <p className={cn("text-xs font-bold uppercase tracking-wide", isHero ? "text-white/90" : "text-gold-400")}>{label}</p>
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            isHero ? "bg-white/20 text-white" : "bg-gold-400/15 text-gold-400",
          )}
        >
          {icon}
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-[26px]">{value}</p>
      {subtitle && <p className={cn("mt-1.5 text-xs font-medium", isHero ? "text-white/80" : "text-slate-400")}>{subtitle}</p>}
      {children}
    </div>
  );
}
