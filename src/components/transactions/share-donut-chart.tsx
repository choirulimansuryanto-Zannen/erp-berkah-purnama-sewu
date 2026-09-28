"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type Row = { name: string; value: number; color: string };

function ShareTooltip({
  active,
  payload,
  valueFormatter,
  total,
}: {
  active?: boolean;
  payload?: { payload: Row }[];
  valueFormatter: (v: number) => string;
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const pct = total > 0 ? Math.round((row.value / total) * 100) : 0;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-slate-800">{row.name}</p>
      <p className="mt-0.5 text-slate-500">
        {valueFormatter(row.value)} · {pct}%
      </p>
    </div>
  );
}

export function ShareDonutChart({
  data,
  valueFormatter,
  centerLabel,
}: {
  data: Row[];
  valueFormatter: (v: number) => string;
  centerLabel: string;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return <div className="flex h-40 items-center justify-center text-sm text-slate-400">Belum ada data.</div>;
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-8">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="95%"
              paddingAngle={3}
              cornerRadius={6}
              stroke="none"
            >
              {data.map((row, i) => (
                <Cell key={i} fill={row.color} />
              ))}
            </Pie>
            <Tooltip content={<ShareTooltip valueFormatter={valueFormatter} total={total} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{centerLabel}</p>
          <p className="text-sm font-semibold text-brand-900">{valueFormatter(total)}</p>
        </div>
      </div>

      <ul className="flex flex-1 flex-col gap-2.5">
        {data.map((row) => {
          const pct = total > 0 ? Math.round((row.value / total) * 100) : 0;
          return (
            <li key={row.name} className="flex items-center gap-2.5 text-sm">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
              <span className="font-medium text-slate-700">{row.name}</span>
              <span className="ml-auto text-slate-500">{valueFormatter(row.value)}</span>
              <span className="w-10 text-right font-semibold text-slate-800">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
