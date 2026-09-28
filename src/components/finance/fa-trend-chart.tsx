"use client";

import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const compactCurrency = new Intl.NumberFormat("id-ID", { notation: "compact", compactDisplay: "short" });

export type FaTrendPoint = { label: string; penjualan: number; hpp: number; labaBersih: number };

const SERIES = [
  { key: "penjualan", label: "Penjualan", color: "#2f56c4" },
  { key: "hpp", label: "HPP", color: "#e2725b" },
  { key: "labaBersih", label: "Laba Bersih", color: "#0f9d58" },
] as const;

function TrendTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="text-slate-400">{label}</p>
      {SERIES.map((s) => {
        const entry = payload.find((p) => p.dataKey === s.key);
        if (!entry) return null;
        return (
          <p key={s.key} className="mt-0.5 flex items-center gap-1.5 font-semibold" style={{ color: s.color }}>
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.label}: {currency.format(entry.value)}
          </p>
        );
      })}
    </div>
  );
}

// Penjualan vs HPP vs Laba Bersih, Jan-Dec — the one chart an FA executive
// dashboard needs at a glance: is growth (Penjualan) outpacing cost (HPP),
// and is the net result (Laba Bersih) actually widening.
export function FaTrendChart({ data }: { data: FaTrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          {SERIES.map((s) => (
            <linearGradient key={s.key} id={`fa-trend-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={s.color} stopOpacity={0.28} />
              <stop offset="95%" stopColor={s.color} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} stroke="#e2e8f0" strokeWidth={1} />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#94a3b8", fontSize: 12 }}
          tickFormatter={(v) => compactCurrency.format(v)}
          width={56}
        />
        <Tooltip content={<TrendTooltip />} cursor={{ stroke: "#cbd5e1", strokeWidth: 1 }} />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, color: "#475569" }}
          formatter={(value) => SERIES.find((s) => s.key === value)?.label ?? value}
        />
        {SERIES.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            stroke={s.color}
            strokeWidth={2}
            fill={`url(#fa-trend-${s.key})`}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
