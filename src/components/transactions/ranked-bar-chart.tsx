"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Row = { name: string; value: number; color?: string };

function TrendTooltip({
  active,
  payload,
  valueFormatter,
}: {
  active?: boolean;
  payload?: { payload: Row }[];
  valueFormatter: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-slate-800">{row.name}</p>
      <p className="mt-0.5 text-slate-500">{valueFormatter(row.value)}</p>
    </div>
  );
}

export function RankedBarChart({
  data,
  valueFormatter,
  defaultColor = "#2f56c4",
}: {
  data: Row[];
  valueFormatter: (v: number) => string;
  defaultColor?: string;
}) {
  if (data.length === 0) {
    return <div className="flex h-32 items-center justify-center text-sm text-slate-400">Belum ada data.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(data.length * 34, 90)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 28, left: 0, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={132}
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#475569", fontSize: 12 }}
        />
        <Tooltip content={<TrendTooltip valueFormatter={valueFormatter} />} cursor={{ fill: "#f1f5f9" }} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={18}>
          {data.map((row, i) => (
            <Cell key={i} fill={row.color ?? defaultColor} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
