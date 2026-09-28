import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "sheen bg-accent-600 text-white hover:bg-accent-700 hover:shadow-lg hover:shadow-accent-600/25 focus-visible:ring-accent-500 shadow-sm",
  secondary:
    "bg-brand-900 text-white hover:bg-brand-800 hover:shadow-lg hover:shadow-brand-900/25 focus-visible:ring-brand-700 shadow-sm",
  outline:
    "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:border-accent-300 focus-visible:ring-slate-400",
  ghost:
    "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-400",
  danger:
    "bg-white text-rose-700 border border-rose-200 hover:bg-rose-50 hover:border-rose-300 focus-visible:ring-rose-400",
  success:
    "bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 focus-visible:ring-emerald-400",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-sm gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150",
        "hover:-translate-y-px active:translate-y-0 active:scale-[0.98]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:active:scale-100",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    />
  );
}
