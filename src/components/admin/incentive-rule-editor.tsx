"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const TYPE_LABELS: Record<string, string> = {
  PRAMU: "Insentive Pramuniaga",
  SPV: "Insentive SPV",
  PENGELOLA: "Insentive Pengelola",
  OFFICER_SALES: "Insentive Officer Sales",
  HEAD_SALES: "Insentive Head Sales",
  OFFICER_MARKETING: "Insentive Officer Marketing",
  HEAD_MARKETING: "Insentive Head Marketing",
  HEAD_FA: "Insentive Head FA",
  HEAD_OPERASIONAL: "Insentive Head Operasional",
  MANAGEMENT: "Insentive Management",
};
const SCOPE_LABELS: Record<string, string> = { OUTLET: "Per Outlet", REGION: "Per Wilayah", COMPANY: "Perusahaan" };
const BASIS_OPTIONS = [
  { value: "PERSEN_OMSET", label: "% Omset" },
  { value: "PERSEN_LABA_KOTOR", label: "% Laba Kotor" },
  { value: "PERSEN_LABA_BERSIH", label: "% Laba Bersih" },
  { value: "NOMINAL_TETAP", label: "Nominal Tetap (Rp)" },
];

export type IncentiveRuleRow = {
  type: string;
  scope: string;
  basis: string;
  rate: number;
  status: string;
};

function RuleRow({ rule }: { rule: IncentiveRuleRow }) {
  const router = useRouter();
  const [basis, setBasis] = useState(rule.basis);
  const [rate, setRate] = useState(String(rule.rate));
  const [status, setStatus] = useState(rule.status);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const dirty = basis !== rule.basis || rate !== String(rule.rate) || status !== rule.status;

  function save() {
    setSaved(false);
    startTransition(async () => {
      const res = await fetch("/api/admin/incentive-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: rule.type, basis, rate: Number(rate), status }),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else {
        window.alert("Gagal menyimpan rate.");
      }
    });
  }

  return (
    <Tr>
      <Td className="font-medium text-slate-900">{TYPE_LABELS[rule.type] ?? rule.type}</Td>
      <Td>
        <Badge tone="info">{SCOPE_LABELS[rule.scope] ?? rule.scope}</Badge>
      </Td>
      <Td>
        <Select value={basis} onChange={(e) => setBasis(e.target.value)} className="min-w-[160px]">
          {BASIS_OPTIONS.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </Select>
      </Td>
      <Td>
        <Input type="number" step="0.0001" min="0" value={rate} onChange={(e) => setRate(e.target.value)} className="w-28" />
      </Td>
      <Td>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="min-w-[110px]">
          <option value="ACTIVE">Aktif</option>
          <option value="INACTIVE">Nonaktif</option>
        </Select>
      </Td>
      <Td>
        <Button variant="secondary" onClick={save} disabled={!dirty || pending}>
          {pending ? "Menyimpan..." : saved ? "Tersimpan ✓" : "Simpan"}
        </Button>
      </Td>
    </Tr>
  );
}

export function IncentiveRuleEditor({ rules }: { rules: IncentiveRuleRow[] }) {
  return (
    <Table>
      <Thead>
        <tr>
          <Th>Jenis Insentif</Th>
          <Th>Lingkup</Th>
          <Th>Basis Perhitungan</Th>
          <Th>Rate</Th>
          <Th>Status</Th>
          <Th></Th>
        </tr>
      </Thead>
      <tbody>
        {rules.map((r) => (
          <RuleRow key={r.type} rule={r} />
        ))}
      </tbody>
    </Table>
  );
}
