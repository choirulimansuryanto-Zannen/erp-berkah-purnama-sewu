"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Trash2 } from "lucide-react";
import { Tr, Td } from "@/components/ui/table";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const CATEGORIES = ["BAHAN_UTAMA", "BAHAN_BAKU_TAMBAHAN", "PACKAGING", "BAHAN_ALAT_PENDUKUNG"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  BAHAN_UTAMA: "Bahan Utama",
  BAHAN_BAKU_TAMBAHAN: "Bahan Baku Tambahan",
  PACKAGING: "Packaging",
  BAHAN_ALAT_PENDUKUNG: "Bahan & Alat Pendukung",
};
const STATUSES = ["ACTIVE", "INACTIVE"] as const;

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

export function OutletMaterialRow({
  id,
  code,
  name,
  category,
  unit,
  unitPrice,
  status,
  hasUsage,
}: {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  unitPrice: number;
  status: string;
  hasUsage: boolean;
}) {
  const router = useRouter();
  const [nameValue, setNameValue] = useState(name);
  const [categoryValue, setCategoryValue] = useState(category);
  const [unitValue, setUnitValue] = useState(unit);
  const [unitPriceValue, setUnitPriceValue] = useState(String(unitPrice));
  const [statusValue, setStatusValue] = useState(status);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await fetch(`/api/admin/outlet-materials/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nameValue,
          category: categoryValue,
          unit: unitValue,
          unitPrice: Number(unitPriceValue) || 0,
          status: statusValue,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
        router.refresh();
      }
    });
  }

  function remove() {
    if (!window.confirm(`Hapus material "${name}"?`)) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/outlet-materials/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) router.refresh();
      else setError(typeof data.error === "string" ? data.error : "Gagal menghapus.");
    });
  }

  return (
    <Tr>
      <Td className="font-mono text-xs text-slate-400">{code}</Td>
      <Td>
        <Input value={nameValue} onChange={(e) => setNameValue(e.target.value)} className="w-48" />
      </Td>
      <Td>
        <Select value={categoryValue} onChange={(e) => setCategoryValue(e.target.value)} className="w-44">
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </Select>
      </Td>
      <Td>
        <Input value={unitValue} onChange={(e) => setUnitValue(e.target.value)} className="w-20" />
      </Td>
      <Td>
        <Input type="number" min="0" value={unitPriceValue} onChange={(e) => setUnitPriceValue(e.target.value)} className="w-28" />
        <p className="mt-0.5 text-[10px] text-slate-400">{currency.format(Number(unitPriceValue) || 0)}</p>
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
            title={hasUsage ? "Sudah pernah dipakai — nonaktifkan saja" : "Hapus material"}
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
