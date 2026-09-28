"use client";

// Thin client-side wrappers around RankedBarChart/ShareDonutChart for server
// components: a Server Component can't pass an arrow function as a prop
// across the client boundary ("Functions cannot be passed directly to
// Client Components"), so the formatter is chosen here, entirely
// client-side, from a plain string/data prop instead.
import { RankedBarChart } from "@/components/transactions/ranked-bar-chart";
import { ShareDonutChart } from "@/components/transactions/share-donut-chart";

type BarRow = { name: string; value: number; color?: string };
type DonutRow = { name: string; value: number; color: string };

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

function makeFormatter(format: "currency" | "percent" | undefined, unit: string | undefined): (v: number) => string {
  if (format === "currency") return (v) => currency.format(v);
  if (format === "percent") return (v) => `${v}%`;
  if (unit) return (v) => `${v} ${unit}`;
  return (v) => String(v);
}

export function FormattedBarChart({
  data,
  format,
  unit,
  defaultColor,
}: {
  data: BarRow[];
  format?: "currency" | "percent";
  unit?: string;
  defaultColor?: string;
}) {
  return <RankedBarChart data={data} valueFormatter={makeFormatter(format, unit)} defaultColor={defaultColor} />;
}

export function FormattedDonutChart({
  data,
  format,
  unit,
  centerLabel,
}: {
  data: DonutRow[];
  format?: "currency" | "percent";
  unit?: string;
  centerLabel: string;
}) {
  return <ShareDonutChart data={data} valueFormatter={makeFormatter(format, unit)} centerLabel={centerLabel} />;
}
