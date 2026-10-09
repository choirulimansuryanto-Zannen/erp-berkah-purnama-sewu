"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import type { CompanyMaterialCategoryGroup, CompanyMaterialRow } from "@/lib/company-material";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const qtyFormat = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 });

// Frozen (sticky) zone covers Kode/Nama Barang/Satuan/Harga-Cost — fixed
// pixel widths so each column's `left` offset stacks correctly while
// scrolling horizontally through the Qty/Nominal columns.
const COL_KODE_W = "w-16";
const COL_NAMA_W = "w-[200px]";
const COL_SATUAN_W = "w-20";
const COL_HARGA_W = "w-28";
const LEFT_KODE = "left-0";
const LEFT_NAMA = "left-16"; // 64px = w-16
const LEFT_SATUAN = "left-[264px]"; // 64 + 200
const LEFT_HARGA = "left-[344px]"; // 64 + 200 + 80

// Qty Saldo Awal, Qty Saldo Akhir, and Qty Faktur Outlet are editable
// directly in the grid — each row auto-saves on blur (or Enter) via the
// same upsert endpoint the entry form below uses, then refreshes the
// page so Nominal/Total Bahan Baku/subtotals recompute server-side.
// Harga/Cost stays display-only here (edited via the form below).
function SkuRow({ row, year, month }: { row: CompanyMaterialRow; year: number; month: number }) {
  const router = useRouter();
  const [saldoAwalQty, setSaldoAwalQty] = useState(String(row.saldoAwalQty));
  const [qtyOpname, setQtyOpname] = useState(String(row.qtyOpname));
  const [fakturOutletQty, setFakturOutletQty] = useState(String(row.fakturOutletQty));
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/finance/company-material", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialId: row.id,
          year,
          month,
          saldoAwalQty: Number(saldoAwalQty || 0),
          qtyOpname: Number(qtyOpname || 0),
          costPerUnit: row.costPerUnit,
          fakturOutletQty: Number(fakturOutletQty || 0),
        }),
      });
      setFailed(!res.ok);
      if (res.ok) router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") e.currentTarget.blur();
  }

  const inputClass =
    "w-full min-w-0 border-0 bg-transparent px-1 py-0.5 text-right tabular-nums text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50";

  // Explicit (not `bg-inherit`) opaque background on the frozen cells —
  // `background: inherit` on a sticky table cell is a known trigger for a
  // Chromium repaint bug where old column content "ghosts" through behind
  // the frozen column while scrolling. A plain `:nth-child`-based odd/even
  // can't be mirrored here (a <td>'s nth-child position is its fixed
  // column index, not its row's), so the 4 frozen columns intentionally
  // give up the zebra stripe and stay solid white, with `group-hover`
  // standing in for the row hover highlight they'd otherwise inherit.
  const stickyCellClass = "bg-white group-hover:bg-gold-50";

  return (
    <tr className="group border-b border-slate-100 odd:bg-white even:bg-slate-50/60 hover:bg-gold-50/40">
      <td className={`sticky will-change-transform ${LEFT_KODE} ${COL_KODE_W} z-10 ${stickyCellClass} px-2 py-1.5 text-slate-500`}>{row.code}</td>
      <td className={`sticky will-change-transform ${LEFT_NAMA} ${COL_NAMA_W} z-10 ${stickyCellClass} px-3 py-1.5 font-medium text-slate-900`}>{row.name}</td>
      <td className={`sticky will-change-transform ${LEFT_SATUAN} ${COL_SATUAN_W} z-10 ${stickyCellClass} px-2 py-1.5 text-slate-500`}>{row.unit}</td>
      <td className={`sticky will-change-transform ${LEFT_HARGA} ${COL_HARGA_W} z-10 border-r border-slate-200 ${stickyCellClass} px-2 py-1.5 text-right tabular-nums`}>
        {row.costPerUnit > 0 ? currency.format(row.costPerUnit) : "-"}
      </td>
      <td className={`bg-rose-50/40 py-1.5 ${failed ? "ring-1 ring-inset ring-red-500" : ""}`} title={failed ? "Gagal menyimpan — coba lagi" : undefined}>
        <input
          className={inputClass}
          type="number"
          step="any"
          value={saldoAwalQty}
          disabled={saving}
          onChange={(e) => setSaldoAwalQty(e.target.value)}
          onBlur={save}
          onKeyDown={onKeyDown}
        />
      </td>
      <td className="bg-rose-50/40 px-2 py-1.5 text-right tabular-nums">{row.saldoAwalNominal !== 0 ? currency.format(row.saldoAwalNominal) : "-"}</td>
      <td className={`bg-rose-50/60 py-1.5 ${failed ? "ring-1 ring-inset ring-red-500" : ""}`}>
        <input
          className={inputClass}
          type="number"
          step="any"
          value={qtyOpname}
          disabled={saving}
          onChange={(e) => setQtyOpname(e.target.value)}
          onBlur={save}
          onKeyDown={onKeyDown}
        />
      </td>
      <td className="bg-rose-50/60 px-2 py-1.5 text-right font-semibold tabular-nums">{row.nilaiAkhir !== 0 ? currency.format(row.nilaiAkhir) : "-"}</td>
      <td className={`bg-gold-50/40 py-1.5 ${failed ? "ring-1 ring-inset ring-red-500" : ""}`}>
        <input
          className={inputClass}
          type="number"
          step="any"
          value={fakturOutletQty}
          disabled={saving}
          onChange={(e) => setFakturOutletQty(e.target.value)}
          onBlur={save}
          onKeyDown={onKeyDown}
        />
      </td>
      <td className="bg-gold-50/40 px-2 py-1.5 text-right tabular-nums">{row.fakturOutletNominal !== 0 ? currency.format(row.fakturOutletNominal) : "-"}</td>
      <td className="bg-sky-50 px-2 py-1.5 text-right tabular-nums">{row.totalBahanBakuQty !== 0 ? qtyFormat.format(row.totalBahanBakuQty) : "-"}</td>
      <td className="bg-sky-50 px-2 py-1.5 text-right font-semibold tabular-nums text-sky-900">
        {row.totalBahanBakuNominal !== 0 ? currency.format(row.totalBahanBakuNominal) : "-"}
      </td>
    </tr>
  );
}

export function CompanyMaterialSkuTable({ groups, year, month }: { groups: CompanyMaterialCategoryGroup[]; year: number; month: number }) {
  return (
    <table className="w-full min-w-[1700px] border-collapse text-xs">
      <thead className="sticky top-0 z-20">
        <tr className="bg-brand-950 text-white">
          <th className={`sticky will-change-transform ${LEFT_KODE} ${COL_KODE_W} z-30 border-r border-brand-900 bg-brand-950 px-2 py-2 text-left`}>Kode</th>
          <th className={`sticky will-change-transform ${LEFT_NAMA} ${COL_NAMA_W} z-30 border-r border-brand-900 bg-brand-950 px-3 py-2 text-left`}>Nama Barang</th>
          <th className={`sticky will-change-transform ${LEFT_SATUAN} ${COL_SATUAN_W} z-30 border-r border-brand-900 bg-brand-950 px-2 py-2 text-left`}>Satuan</th>
          <th className={`sticky will-change-transform ${LEFT_HARGA} ${COL_HARGA_W} z-30 border-r border-brand-900 bg-brand-950 px-2 py-2 text-right`}>Harga / Cost</th>
          <th className="border-r border-rose-700 bg-rose-600 px-2 py-2 text-right">Qty Saldo Awal</th>
          <th className="border-r border-brand-900 bg-rose-600 px-2 py-2 text-right">Nominal Saldo Awal</th>
          <th className="border-r border-rose-800 bg-rose-700 px-2 py-2 text-right">Qty Saldo Akhir</th>
          <th className="border-r border-brand-900 bg-rose-700 px-2 py-2 text-right">Nominal Saldo Akhir</th>
          <th className="border-r border-gold-700 bg-gold-600 px-2 py-2 text-right text-brand-950">Qty Faktur Outlet</th>
          <th className="border-r border-brand-900 bg-gold-600 px-2 py-2 text-right text-brand-950">Nominal Faktur Outlet</th>
          <th className="border-r border-sky-800 bg-sky-700 px-2 py-2 text-right">Qty Total Bahan Baku</th>
          <th className="bg-sky-700 px-2 py-2 text-right">Nominal Total Bahan Baku</th>
        </tr>
      </thead>
      <tbody>
        {groups.map((g, gi) => {
          const prevSuperGroup = gi > 0 ? groups[gi - 1].superGroup : null;
          const showSuperGroupBanner = g.superGroup && g.superGroup !== prevSuperGroup;
          return (
            <Fragment key={g.category}>
              {showSuperGroupBanner && (
                <tr className="bg-blue-100">
                  <td colSpan={12} className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-blue-900">
                    {g.superGroup}
                  </td>
                </tr>
              )}
              {!g.superGroup && (
                <tr className="bg-blue-100">
                  <td colSpan={12} className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-blue-900">
                    {g.label}
                  </td>
                </tr>
              )}
              {g.superGroup && (
                <tr className="bg-rose-50">
                  <td colSpan={12} className="px-5 py-1 text-[11px] font-bold uppercase tracking-wide text-rose-700">
                    {g.label}
                  </td>
                </tr>
              )}
              {g.rows.map((r) => (
                <SkuRow key={r.id} row={r} year={year} month={month} />
              ))}
              <tr className="bg-gold-50 font-bold text-brand-900">
                <td colSpan={4} className={`sticky will-change-transform ${LEFT_KODE} z-10 bg-gold-50 px-3 py-1.5`}>
                  TOTAL NOMINAL {g.label}
                </td>
                <td />
                <td className="px-2 py-1.5 text-right tabular-nums">{currency.format(g.totalSaldoAwalNominal)}</td>
                <td />
                <td className="px-2 py-1.5 text-right tabular-nums">{currency.format(g.totalNilaiAkhir)}</td>
                <td />
                <td className="px-2 py-1.5 text-right tabular-nums">{currency.format(g.totalFakturNominal)}</td>
                <td />
                <td className="px-2 py-1.5 text-right tabular-nums">{currency.format(g.totalNominal)}</td>
              </tr>
            </Fragment>
          );
        })}
        {groups.length === 0 && (
          <tr>
            <td colSpan={12} className="px-3 py-6 text-center text-slate-400">
              Belum ada data item.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
