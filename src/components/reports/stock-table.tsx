"use client";

import { cn } from "@/lib/cn";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("id-ID");

export type StockPreviewLine = { productId: string | null; toppingId: string | null; itemName: string; unitPrice: number; terjualSistem: number };

// A small boxed number input for the manual Ambil/Sisa columns — blank
// reads as 0 for computation, but stays blank on screen so a cashier isn't
// staring at a wall of zeros before they've counted anything.
export function CountInput({
  value,
  onChange,
  onBlur,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  className?: string;
}) {
  return (
    <input
      type="number"
      min={0}
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder="0"
      className={cn(
        "field-glow w-20 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-center text-sm text-slate-900",
        "placeholder:text-slate-300 focus:border-accent-500 focus:outline-none",
        className,
      )}
    />
  );
}

// Shared between the Daily Report page and Summary Setoran Outlet's
// "Mirroring Form Laporan" table — same data, same Ambil/Sisa draft (see
// DailyReportStockDraft), same computed Terjual/Laku/Nominal columns.
export function StockTable({
  lines,
  values,
  onChange,
  onBlurField,
}: {
  lines: StockPreviewLine[];
  values: { ambil: string; sisa: string }[];
  onChange: (index: number, field: "ambil" | "sisa", v: string) => void;
  onBlurField: (index: number) => void;
}) {
  const rows = lines.map((line, i) => {
    const ambilStr = values[i]?.ambil ?? "";
    const sisaStr = values[i]?.sisa ?? "";
    const ambil = Number(ambilStr || 0);
    const sisa = Number(sisaStr || 0);
    // Before the cashier has counted anything (both fields still blank),
    // Laku defaults to the system-computed Terjual so the row — and Total
    // Omset below — isn't misleadingly showing 0. The moment either field
    // gets a real count, Laku switches to the actual Ambil − Sisa.
    const hasManualCount = ambilStr !== "" || sisaStr !== "";
    const laku = hasManualCount ? ambil - sisa : line.terjualSistem;
    const nominal = laku * line.unitPrice;
    return { line, ambil, sisa, laku, nominal };
  });
  const totalOmset = computeStockTotalOmset(lines, values);

  return (
    <Table>
      <Thead>
        <tr>
          <Th>No.</Th>
          <Th>Bahan Baku</Th>
          <Th className="text-right">Harga</Th>
          <Th className="text-center">
            Ambil (PCS)
            <span className="block text-[10px] font-normal normal-case text-slate-400">(manual)</span>
          </Th>
          <Th className="text-center">
            Sisa (PCS)
            <span className="block text-[10px] font-normal normal-case text-slate-400">(manual)</span>
          </Th>
          <Th className="text-center">
            Terjual
            <span className="block text-[10px] font-normal normal-case text-slate-400">(sistem)</span>
          </Th>
          <Th className="text-center">
            Laku (PCS)
            <span className="block text-[10px] font-normal normal-case text-slate-400">(ambil-sisa)</span>
          </Th>
          <Th className="text-right">
            Nominal (Rp.)
            <span className="block text-[10px] font-normal normal-case text-slate-400">(harga x laku)</span>
          </Th>
        </tr>
      </Thead>
      <tbody>
        {rows.map(({ line, laku, nominal }, i) => (
          <Tr key={`${line.productId ?? line.toppingId ?? i}`}>
            <Td className="text-slate-400">{i + 1}</Td>
            <Td className="font-semibold text-slate-900">{line.itemName}</Td>
            <Td className="text-right text-slate-600">{currency.format(line.unitPrice)}</Td>
            <Td className="text-center">
              <CountInput value={values[i]?.ambil ?? ""} onChange={(v) => onChange(i, "ambil", v)} onBlur={() => onBlurField(i)} />
            </Td>
            <Td className="text-center">
              <CountInput value={values[i]?.sisa ?? ""} onChange={(v) => onChange(i, "sisa", v)} onBlur={() => onBlurField(i)} />
            </Td>
            <Td className="text-center font-bold text-accent-700">{number.format(line.terjualSistem)}</Td>
            <Td className={cn("text-center font-bold", laku < 0 ? "text-rose-600" : "text-slate-900")}>{number.format(laku)}</Td>
            <Td className="text-right font-bold text-slate-900">{number.format(nominal)}</Td>
          </Tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-slate-300">
          <td colSpan={7} className="px-5 py-3 text-right text-sm font-bold text-slate-800">
            Total Omset
          </td>
          <td className="bg-emerald-50 px-5 py-3 text-right text-sm font-bold text-emerald-700">{number.format(totalOmset)}</td>
        </tr>
      </tfoot>
    </Table>
  );
}

// Shared hook-like helper: build the {ambil,sisa} string-state array from a
// server-provided draft, used identically by both pages' top-level state init.
export function initialStockValues(count: number, draft: { ambil: number; sisa: number }[]): { ambil: string; sisa: string }[] {
  return Array.from({ length: count }, (_, i) => ({
    ambil: draft[i]?.ambil ? String(draft[i].ambil) : "",
    sisa: draft[i]?.sisa ? String(draft[i].sisa) : "",
  }));
}

// The same per-row Laku/Nominal logic StockTable renders internally,
// exposed so a caller outside the table (Rekap Summary's "Total Omset
// Penjualan") can read the identical total rather than a differently-scoped
// figure that could silently disagree with what Table 1 itself displays.
export function computeStockTotalOmset(lines: StockPreviewLine[], values: { ambil: string; sisa: string }[]): number {
  return lines.reduce((sum, line, i) => {
    const ambilStr = values[i]?.ambil ?? "";
    const sisaStr = values[i]?.sisa ?? "";
    const hasManualCount = ambilStr !== "" || sisaStr !== "";
    const laku = hasManualCount ? Number(ambilStr || 0) - Number(sisaStr || 0) : line.terjualSistem;
    return sum + laku * line.unitPrice;
  }, 0);
}
