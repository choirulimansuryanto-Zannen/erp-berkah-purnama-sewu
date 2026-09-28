import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200",
  success: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  warning: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200",
  danger: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200",
  info: "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200",
  brand: "bg-accent-50 text-accent-800 ring-1 ring-inset ring-accent-200",
};

const STATUS_TONE: Record<string, Tone> = {
  APPROVED: "success",
  ACTIVE: "success",
  RECONCILED: "success",
  COMPLETED: "success",
  PENDING: "warning",
  SPV_REVIEW: "warning",
  REVISION: "warning",
  ESCALATED: "danger",
  REJECTED: "danger",
  VOIDED: "danger",
  SUSPENDED: "danger",
  INACTIVE: "neutral",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    />
  );
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge tone={STATUS_TONE[status] ?? "neutral"} className={className}>
      {status}
    </Badge>
  );
}
