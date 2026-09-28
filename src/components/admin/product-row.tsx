"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2 } from "lucide-react";
import { Tr, Td } from "@/components/ui/table";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const STATUSES = ["ACTIVE", "SEASONAL", "INACTIVE"] as const;
const CATEGORIES = ["ALACARTE", "PAKET_ONLINE", "PAKET_MBG", "PAKET_KOPDES", "PAKET_PAHLAWAN"] as const;

export function ProductRow({
  id,
  sku,
  name,
  category,
  price,
  cost,
  status,
  hasSales,
}: {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  status: string;
  hasSales: boolean;
}) {
  const router = useRouter();
  const [nameValue, setNameValue] = useState(name);
  const [categoryValue, setCategoryValue] = useState(category);
  const [priceValue, setPriceValue] = useState(String(price));
  const [costValue, setCostValue] = useState(String(cost));
  const [statusValue, setStatusValue] = useState(status);
  const [saved, setSaved] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [deleting, startDeleteTransition] = useTransition();

  const margin = Number(priceValue) > 0 ? Math.round(((Number(priceValue) - Number(costValue)) / Number(priceValue)) * 100) : 0;

  function save() {
    startTransition(async () => {
      await fetch(`/api/admin/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nameValue,
          category: categoryValue,
          price: Number(priceValue),
          cost: Number(costValue),
          status: statusValue,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  function remove() {
    if (!window.confirm(`Hapus produk "${nameValue}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    setDeleteError(null);
    startDeleteTransition(async () => {
      const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setDeleteError(typeof data.error === "string" ? data.error : "Gagal menghapus produk.");
      }
    });
  }

  return (
    <Tr>
      <Td>
        <Input value={nameValue} onChange={(e) => setNameValue(e.target.value)} className="min-w-[160px]" />
      </Td>
      <Td className="text-slate-400">{sku}</Td>
      <Td>
        <Select value={categoryValue} onChange={(e) => setCategoryValue(e.target.value)} className="w-40">
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c.replace("_", " ")}
            </option>
          ))}
        </Select>
      </Td>
      <Td>
        <Input type="number" value={priceValue} onChange={(e) => setPriceValue(e.target.value)} className="w-28" />
      </Td>
      <Td>
        <Input type="number" value={costValue} onChange={(e) => setCostValue(e.target.value)} className="w-28" />
      </Td>
      <Td className={margin < 20 ? "text-amber-600" : "text-emerald-600"}>{margin}%</Td>
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
        <div className="flex items-center gap-1.5">
          <Button onClick={save} disabled={pending} variant="outline" size="sm">
            {saved ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" /> Tersimpan
              </>
            ) : (
              "Simpan"
            )}
          </Button>
          <Button
            onClick={remove}
            disabled={deleting || hasSales}
            variant="danger"
            size="sm"
            title={hasSales ? "Sudah pernah terjual — nonaktifkan lewat status, bukan hapus" : "Hapus produk"}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        {deleteError && <p className="mt-1 text-xs text-rose-600">{deleteError}</p>}
      </Td>
    </Tr>
  );
}
