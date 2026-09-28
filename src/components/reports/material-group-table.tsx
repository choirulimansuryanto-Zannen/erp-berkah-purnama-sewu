"use client";

import { cn } from "@/lib/cn";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { CountInput } from "@/components/reports/stock-table";

export type RawMaterialLine = { id: string; name: string; unit: string; group: "DAGING" | "SAYUR" | "SAOS_KEMASAN" };

// Underlined, boxless variant for the Saos & Kemasan "Pakai" column —
// visually distinct from the boxed Ketul/Kg inputs, matching the mockup's
// dotted-underline style for pack counts.
function UnderlineInput({ value, onChange, onBlur }: { value: string; onChange: (v: string) => void; onBlur?: () => void }) {
  return (
    <input
      type="number"
      min={0}
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder="........"
      className="field-glow w-20 border-b border-dashed border-slate-300 bg-transparent px-1 py-1 text-center text-sm text-slate-900 placeholder:text-slate-300 focus:border-accent-500 focus:outline-none"
    />
  );
}

// Shared between Daily Report and Summary Setoran Outlet — the Daging/
// Sayur/Bahan Baku (Saos & Kemasan) usage tables live on Setoran (see
// DailyReportMaterialDraft), rendered with this same component either way.
export function MaterialGroupTable({
  title,
  unitLabel,
  materials,
  values,
  onChange,
  onBlurField,
  underline = false,
}: {
  title: string;
  unitLabel: string;
  materials: RawMaterialLine[];
  values: Record<string, string>;
  onChange: (rawMaterialId: string, v: string) => void;
  onBlurField: (rawMaterialId: string) => void;
  underline?: boolean;
}) {
  return (
    <Table>
      <Thead>
        <tr>
          <Th>No.</Th>
          <Th>{title}</Th>
          <Th className="text-center">{unitLabel}</Th>
        </tr>
      </Thead>
      <tbody>
        {materials.map((m, i) => (
          <Tr key={m.id}>
            <Td className="text-slate-400">{i + 1}</Td>
            <Td className="font-semibold text-slate-900">{m.name}</Td>
            <Td className="text-center">
              {underline ? (
                <span className={cn("inline-flex items-center gap-1.5")}>
                  <UnderlineInput value={values[m.id] ?? ""} onChange={(v) => onChange(m.id, v)} onBlur={() => onBlurField(m.id)} />
                  <span className="text-xs text-slate-400">{m.unit}</span>
                </span>
              ) : (
                <CountInput value={values[m.id] ?? ""} onChange={(v) => onChange(m.id, v)} onBlur={() => onBlurField(m.id)} />
              )}
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}

export function initialMaterialValues(materials: RawMaterialLine[], draft: Record<string, number>): Record<string, string> {
  return Object.fromEntries(materials.map((m) => [m.id, draft[m.id] ? String(draft[m.id]) : ""]));
}
