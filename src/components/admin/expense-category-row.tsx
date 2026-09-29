"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Trash2 } from "lucide-react";
import { Tr, Td } from "@/components/ui/table";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const STATUSES = ["ACTIVE", "SEASONAL", "INACTIVE"] as const;
const OVERHEAD_GROUPS = ["DIRECT", "INDIRECT", "NONE"] as const;
const OVERHEAD_GROUP_LABELS: Record<string, string> = {
  DIRECT: "Overhead Langsung",
  INDIRECT: "Overhead Tidak Langsung",
  NONE: "Bukan Biaya (masuk Pembelian)",
};

export function ExpenseCategoryRow({
  id,
  keyName,
  label,
  sortOrder,
  status,
  overheadGroup,
  hasUsage,
}: {
  id: string;
  keyName: string;
  label: string;
  sortOrder: number;
  status: string;
  overheadGroup: string;
  hasUsage: boolean;
}) {
  const router = useRouter();
  const [labelValue, setLabelValue] = useState(label);
  const [sortOrderValue, setSortOrderValue] = useState(String(sortOrder));
  const [statusValue, setStatusValue] = useState(status);
  const [overheadGroupValue, setOverheadGroupValue] = useState(overheadGroup);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await fetch(`/api/admin/expense-categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: labelValue, sortOrder: Number(sortOrderValue), status: statusValue, overheadGroup: overheadGroupValue }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
        router.refresh();
      }
    });
  }

  function remove() {
    if (!window.confirm(`Hapus kategori "${label}"?`)) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/expense-categories/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        router.refresh();
      } else {
        setError(typeof data.error === "string" ? data.error : "Gagal menghapus.");
      }
    });
  }

  return (
    <Tr>
      <Td className="font-mono text-xs text-slate-400">{keyName}</Td>
      <Td>
        <Input value={labelValue} onChange={(e) => setLabelValue(e.target.value)} className="w-48" />
      </Td>
      <Td>
        <Input type="number" value={sortOrderValue} onChange={(e) => setSortOrderValue(e.target.value)} className="w-20" />
      </Td>
      <Td>
        <Select value={statusValue} onChange={(e) => setStatusValue(e.target.value)} className="w-32">
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </Td>
      <Td>
        <Select value={overheadGroupValue} onChange={(e) => setOverheadGroupValue(e.target.value)} className="w-44">
          {OVERHEAD_GROUPS.map((g) => (
            <option key={g} value={g}>
              {OVERHEAD_GROUP_LABELS[g]}
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
            title={hasUsage ? "Sudah pernah dipakai — nonaktifkan saja" : "Hapus kategori"}
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
