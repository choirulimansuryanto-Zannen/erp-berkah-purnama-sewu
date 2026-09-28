"use client";

import { useState } from "react";
import { Snowflake } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/card";

const number = new Intl.NumberFormat("id-ID");

export type FreezerRow = {
  id: string;
  name: string;
  unit: string;
  minStock: number;
  openingBalance: number;
  received: number;
  used: number;
  rejected: number;
  closingBalance: number;
};

// A boxed number input tinted to its own column's color — Saldo Awal
// (gold), Saldo Masuk (teal), Reject (rose) are editable; Pakai (blue) is
// always disabled since it's a live mirror of the Laporan Harian tables,
// never a manual entry (see src/lib/freezer-stock.ts).
function ColorInput({
  value,
  onChange,
  onBlur,
  disabled,
  colorClass,
}: {
  value: string;
  onChange?: (v: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  colorClass: string;
}) {
  return (
    <input
      type="number"
      min={0}
      inputMode="numeric"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.value)}
      onBlur={onBlur}
      className={cn(
        "field-glow w-full rounded-lg border-2 bg-white px-3 py-2 text-center text-sm font-semibold text-slate-900",
        "focus:outline-none disabled:bg-slate-50 disabled:text-slate-500",
        colorClass,
      )}
    />
  );
}

function HeaderCell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-3 text-center text-xs font-bold uppercase tracking-wide", className)}>{children}</th>;
}

// One row's own local state — Saldo Awal/Masuk/Reject are edited freely and
// saved on blur; Pakai/Saldo Akhir are updated from whatever the save
// response returns (server-recomputed), not derived client-side, since
// Pakai depends on live sales data this component has no other way to see.
function FreezerStockTableRow({ row, index, editable }: { row: FreezerRow; index: number; editable: boolean }) {
  const [opening, setOpening] = useState(String(row.openingBalance));
  const [received, setReceived] = useState(String(row.received));
  const [rejected, setRejected] = useState(String(row.rejected));
  const [used, setUsed] = useState(row.used);
  const [closing, setClosing] = useState(row.closingBalance);

  function save() {
    fetch("/api/inventory/freezer-stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        freezerMaterialId: row.id,
        openingBalance: Number(opening || 0),
        received: Number(received || 0),
        rejected: Number(rejected || 0),
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.used === "number") setUsed(data.used);
        if (typeof data.closingBalance === "number") setClosing(data.closingBalance);
      })
      .catch(() => {});
  }

  const isTipis = closing > 0 && closing <= row.minStock;
  const isEmpty = closing <= 0;

  return (
    <tr className="border-b border-slate-100 odd:bg-white even:bg-slate-50/50">
      <td className="px-4 py-3 text-center text-sm text-slate-400">{index}</td>
      <td className="px-4 py-3">
        <p className="font-semibold text-slate-900">{row.name}</p>
      </td>
      <td className="px-4 py-3 text-center">
        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
          {row.unit}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <ColorInput value={opening} onChange={setOpening} onBlur={save} disabled={!editable} colorClass="border-amber-300 focus:border-amber-500" />
      </td>
      <td className="px-3 py-2.5">
        <ColorInput value={received} onChange={setReceived} onBlur={save} disabled={!editable} colorClass="border-emerald-300 focus:border-emerald-500" />
      </td>
      <td className="px-3 py-2.5">
        <ColorInput value={String(used)} disabled colorClass="border-blue-300" />
      </td>
      <td className="px-3 py-2.5">
        <ColorInput value={rejected} onChange={setRejected} onBlur={save} disabled={!editable} colorClass="border-rose-300 focus:border-rose-500" />
      </td>
      <td className="px-4 py-3 text-center">
        <div className="flex items-center justify-center gap-2">
          {isTipis && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-800">Tipis</span>
          )}
          <span className={cn("text-base font-bold", isEmpty ? "text-rose-600" : isTipis ? "text-amber-700" : "text-emerald-700")}>
            {number.format(closing)}
          </span>
        </div>
      </td>
    </tr>
  );
}

export function FreezerStockTable({
  rows,
  editable,
  dateLabel,
}: {
  rows: FreezerRow[];
  editable: boolean;
  dateLabel: string;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between bg-brand-950 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Snowflake className="h-4 w-4 text-white" />
          <p className="text-sm font-bold uppercase tracking-wide text-white">Stock Freezer — {dateLabel}</p>
        </div>
        {!editable && <span className="text-xs font-bold uppercase tracking-wide text-gold-400">Riwayat (baca saja)</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-brand-950">
              <HeaderCell className="text-white">No.</HeaderCell>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-white">Nama Barang</th>
              <HeaderCell className="text-white">Satuan</HeaderCell>
              <HeaderCell className="bg-amber-500 text-brand-950">Saldo Awal</HeaderCell>
              <HeaderCell className="bg-emerald-600 text-white">Saldo Masuk</HeaderCell>
              <HeaderCell className="bg-blue-800 text-white">
                Pakai
                <span className="block text-[9px] font-normal normal-case text-blue-200">(mirror form laporan)</span>
              </HeaderCell>
              <HeaderCell className="bg-rose-800 text-white">
                Reject
                <span className="block text-[9px] font-normal normal-case text-rose-200">(manual)</span>
              </HeaderCell>
              <HeaderCell className="text-gold-400">Saldo Akhir</HeaderCell>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <FreezerStockTableRow key={row.id} row={row} index={i + 1} editable={editable} />
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-400">
                  Belum ada item Stock Freezer.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
