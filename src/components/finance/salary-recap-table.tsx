"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SalaryRecapColumn, SalaryRecapLineItem } from "@/lib/salary-recap";

// Duplicated from lib/salary-recap.ts rather than imported as a value —
// that module also exports a Prisma query, and a value import (unlike a
// type-only one) would pull the whole module, Prisma included, into this
// client bundle.
const SALARY_RECAP_LINE_LABELS: Record<SalaryRecapLineItem, string> = {
  totalTerimaNet: "Total Terima (NET)",
  koperasi: "KOPERASI",
  iuranBpjs: "Iuran BPJS",
  kasbon: "Kasbon",
  pph21: "PPh21",
  adjLain: "ADJ Lain",
  sanksi: "Sanksi",
  insentifTjOutlet: "Insentive&Tj.Outlet",
};
const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const LINE_ITEM_KEYS = Object.keys(SALARY_RECAP_LINE_LABELS) as SalaryRecapLineItem[];

// Every figure is editable directly in the grid — one column per
// department, auto-saving the whole department's row onBlur/Enter (the
// API upserts all 8 line items together per department, so a save always
// sends the full current snapshot, never just the one cell that changed).
// TOTAL (aktual) and Total Row stay server-computed, refreshing after a
// save rather than recalculating live from unsaved keystrokes.
export function SalaryRecapTable({
  columns,
  rowTotals,
  grandTotal,
  year,
  month,
}: {
  columns: SalaryRecapColumn[];
  rowTotals: Record<SalaryRecapLineItem, number>;
  grandTotal: number;
  year: number;
  month: number;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, Record<string, string>>>(() =>
    Object.fromEntries(columns.map((c) => [c.department, Object.fromEntries(LINE_ITEM_KEYS.map((k) => [k, String(c.values[k])]))])),
  );
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [failed, setFailed] = useState<Record<string, boolean>>({});

  function setCell(dept: string, key: string, v: string) {
    setValues((prev) => ({ ...prev, [dept]: { ...prev[dept], [key]: v } }));
  }

  async function save(dept: string) {
    setSaving((s) => ({ ...s, [dept]: true }));
    try {
      const body = {
        year,
        month,
        department: dept,
        ...Object.fromEntries(LINE_ITEM_KEYS.map((k) => [k, Number(values[dept]?.[k] || 0)])),
      };
      const res = await fetch("/api/finance/salary-recap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setFailed((f) => ({ ...f, [dept]: !res.ok }));
      if (res.ok) router.refresh();
    } catch {
      setFailed((f) => ({ ...f, [dept]: true }));
    } finally {
      setSaving((s) => ({ ...s, [dept]: false }));
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") e.currentTarget.blur();
  }

  return (
    <table className="w-full min-w-[1300px] border-collapse text-xs">
      <thead>
        <tr className="bg-brand-950 text-white">
          <th className="sticky will-change-transform left-0 z-10 border-r border-brand-900 bg-brand-950 px-3 py-2 text-left">Keterangan</th>
          {columns.map((c) => (
            <th key={c.department} className="border-r border-brand-900 px-3 py-2 text-right">
              {c.label}
            </th>
          ))}
          <th className="px-3 py-2 text-right">Total Row</th>
        </tr>
      </thead>
      <tbody>
        {LINE_ITEM_KEYS.map((key) => (
          <tr key={key} className="border-b border-slate-100 odd:bg-white even:bg-slate-50/60">
            <td className="sticky will-change-transform left-0 z-10 bg-white px-3 py-1.5 font-medium text-slate-900">{SALARY_RECAP_LINE_LABELS[key]}</td>
            {columns.map((c) => (
              <td key={c.department} className={`px-1 py-1 ${failed[c.department] ? "ring-1 ring-inset ring-red-500" : ""}`} title={failed[c.department] ? "Gagal menyimpan — coba lagi" : undefined}>
                <input
                  className="w-full min-w-0 border-0 bg-transparent px-2 py-1 text-right tabular-nums text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
                  type="number"
                  step="any"
                  value={values[c.department]?.[key] ?? "0"}
                  disabled={saving[c.department]}
                  onChange={(e) => setCell(c.department, key, e.target.value)}
                  onBlur={() => save(c.department)}
                  onKeyDown={onKeyDown}
                />
              </td>
            ))}
            <td className="bg-gold-50/40 px-3 py-1.5 text-right font-semibold tabular-nums text-brand-900">{rowTotals[key] > 0 ? currency.format(rowTotals[key]) : "-"}</td>
          </tr>
        ))}
        <tr className="bg-brand-900 font-bold text-white">
          <td className="sticky will-change-transform left-0 z-10 bg-brand-900 px-3 py-2">TOTAL (aktual)</td>
          {columns.map((c) => (
            <td key={c.department} className="px-3 py-2 text-right tabular-nums">
              {currency.format(c.total)}
            </td>
          ))}
          <td className="px-3 py-2 text-right tabular-nums">{currency.format(grandTotal)}</td>
        </tr>
      </tbody>
    </table>
  );
}
