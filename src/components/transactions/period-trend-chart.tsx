"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Point = { label: string; omset: number; orders: number };

function TrendTooltip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="text-slate-400">{point.label}</p>
      <p className="mt-0.5 font-semibold text-brand-900">
        {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(point.omset)}
      </p>
      <p className="text-slate-500">{point.orders} pesanan</p>
    </div>
  );
}

export function PeriodTrendChart({ data }: { data: Point[] }) {
  const compactCurrency = new Intl.NumberFormat("id-ID", { notation: "compact", compactDisplay: "short" });

  if (data.length === 0) {
    return <div className="flex h-52 items-center justify-center text-sm text-slate-400">Belum ada data.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
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
        <Area
          type="monotone"
          dataKey="omset"
          stroke="#2f56c4"
          strokeWidth={2}
          fill="#2f56c4"
          fillOpacity={0.1}
          dot={{ r: 4, fill: "#2f56c4", stroke: "#ffffff", strokeWidth: 2 }}
          activeDot={{ r: 6, fill: "#2f56c4", stroke: "#ffffff", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
