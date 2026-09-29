"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Trash2 } from "lucide-react";
import { Tr, Td } from "@/components/ui/table";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const SIDES = ["D", "C"] as const;
const STATUSES = ["ACTIVE", "INACTIVE"] as const;

export function OutletLedgerAccountRow({
  id,
  number,
  label,
  defaultSide,
  sortOrder,
  status,
  hasUsage,
}: {
  id: string;
  number: number;
  label: string;
  defaultSide: string;
  sortOrder: number;
  status: string;
  hasUsage: boolean;
}) {
  const router = useRouter();
  const [labelValue, setLabelValue] = useState(label);
  const [sideValue, setSideValue] = useState(defaultSide);
  const [sortOrderValue, setSortOrderValue] = useState(String(sortOrder));
  const [statusValue, setStatusValue] = useState(status);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await fetch(`/api/admin/outlet-ledger-accounts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: labelValue, defaultSide: sideValue, sortOrder: Number(sortOrderValue) || 0, status: statusValue }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
        router.refresh();
      }
    });
  }

  function remove() {
    if (!window.confirm(`Hapus akun "${number} — ${label}"?`)) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/outlet-ledger-accounts/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) router.refresh();
      else setError(typeof data.error === "string" ? data.error : "Gagal menghapus.");
    });
  }

  return (
    <Tr>
      <Td className="font-mono text-xs text-slate-400">{number}</Td>
      <Td>
        <Input value={labelValue} onChange={(e) => setLabelValue(e.target.value)} className="w-64" />
      </Td>
      <Td>
        <Select value={sideValue} onChange={(e) => setSideValue(e.target.value)} className="w-20">
          {SIDES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </Td>
      <Td>
        <Input type="number" value={sortOrderValue} onChange={(e) => setSortOrderValue(e.target.value)} className="w-16" />
      </Td>
      <Td>
        <Select value={statusValue} onChange={(e) => setStatusValue(e.target.value)} className="w-28">
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </Td>
      <Td>
        <div className="flex items-center gap-2">
          <Button onClick={save} disabled={pending} variant="outline" size="sm">
            {saved ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" /> Tersimpan
              </>
            ) : (
              "Simpan"
            )}
          </Button>
          <button
            onClick={remove}
            disabled={pending || hasUsage}
            title={hasUsage ? "Sudah pernah dipakai — nonaktifkan saja" : "Hapus akun"}
            className="flex h-8 w-8 items-center justify-center rounded-md text-rose-400 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      </Td>
    </Tr>
  );
}
