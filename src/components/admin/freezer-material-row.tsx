"use client";

import { useState, useTransition } from "react";
import { Check, Trash2 } from "lucide-react";
import { Tr, Td } from "@/components/ui/table";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const STATUSES = ["ACTIVE", "INACTIVE", "SEASONAL"] as const;

export function FreezerMaterialRow({
  id,
  name,
  unit,
  sortOrder,
  minStock,
  status,
}: {
  id: string;
  name: string;
  unit: string;
  sortOrder: number;
  minStock: number;
  status: string;
}) {
  const [nameValue, setNameValue] = useState(name);
  const [unitValue, setUnitValue] = useState(unit);
  const [sortOrderValue, setSortOrderValue] = useState(String(sortOrder));
  const [minStockValue, setMinStockValue] = useState(String(minStock));
  const [statusValue, setStatusValue] = useState(status);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      await fetch(`/api/admin/freezer-materials/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nameValue,
          unit: unitValue,
          sortOrder: Number(sortOrderValue || 0),
          minStock: Number(minStockValue || 0),
          status: statusValue,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await fetch(`/api/admin/freezer-materials/${id}`, { method: "DELETE" });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Gagal menghapus.");
      }
    });
  }

  return (
    <Tr>
      <Td>
        <Input value={nameValue} onChange={(e) => setNameValue(e.target.value)} className="w-48" />
      </Td>
      <Td>
        <Input value={unitValue} onChange={(e) => setUnitValue(e.target.value)} className="w-24" />
      </Td>
      <Td>
        <Input type="number" min={0} value={sortOrderValue} onChange={(e) => setSortOrderValue(e.target.value)} className="w-20" />
      </Td>
      <Td>
        <Input type="number" min={0} value={minStockValue} onChange={(e) => setMinStockValue(e.target.value)} className="w-20" />
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
            disabled={pending}
            title="Hapus"
            className="flex h-8 w-8 items-center justify-center rounded-md text-rose-400 hover:bg-rose-50 hover:text-rose-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        {error && <p className="mt-1.5 text-xs text-rose-600">{error}</p>}
      </Td>
    </Tr>
  );
}
