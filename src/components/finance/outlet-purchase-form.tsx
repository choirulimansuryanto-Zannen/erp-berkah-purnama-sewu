"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Label, Input, Textarea, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const CATEGORY_LABELS: Record<string, string> = {
  BAHAN: "Bahan (Barang Masuk Manual)",
  BAHAN_EKSTERNAL: "Bahan Eksternal",
  BAHAN_PENDUKUNG: "Bahan & Alat Pendukung",
  SAYUR: "Sayur",
  GAS: "Gas",
  ANGKUT: "Angkut",
  POTONGAN: "Potongan Pembelian",
  LAINNYA: "Lainnya",
};

export function OutletPurchaseDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function remove() {
    if (!window.confirm("Hapus data pembelian ini?")) return;
    startTransition(async () => {
      const res = await fetch(`/api/finance/outlet-purchases/${id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
      else window.alert("Gagal menghapus data.");
    });
  }
  return (
    <button onClick={remove} disabled={pending} title="Hapus" className="flex h-7 w-7 items-center justify-center rounded-md text-rose-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30">
      <X className="h-3.5 w-3.5" />
    </button>
  );
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// Purchase Sheet input — direct/local outlet purchases (fresh produce from
// a nearby market, a local mitra vendor, ...), distinct from warehouse
// distributions which already show up on the Inventory Sheet's "Masuk".
export function OutletPurchaseForm({
  outletId,
  materials = [],
}: {
  outletId: string;
  materials?: { id: string; code: string; name: string; unit: string }[];
}) {
  const router = useRouter();
  const [date, setDate] = useState(todayStr());
  const [description, setDescription] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("pcs");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState("BAHAN");
  const [materialId, setMaterialId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    setSuccess(false);
    startTransition(async () => {
      const res = await fetch("/api/finance/outlet-purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outletId,
          date,
          description,
          qty: Number(qty),
          unit,
          amount: Number(amount),
          note: note || undefined,
          category,
          materialId: materialId || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage("Pembelian tersimpan.");
        setSuccess(true);
        setDescription("");
        setQty("1");
        setAmount("");
        setNote("");
        router.refresh();
      } else {
        setMessage(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div>
          <Label className="text-[11px]">Tanggal</Label>
          <Input className="mt-1" type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-[11px]">Deskripsi</Label>
          <Input className="mt-1" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Contoh: Sayur dari pasar lokal" />
        </div>
        <div>
          <Label className="text-[11px]">Qty</Label>
          <Input className="mt-1" type="number" min="0" step="0.01" value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>
        <div>
          <Label className="text-[11px]">Satuan</Label>
          <Input className="mt-1" value={unit} onChange={(e) => setUnit(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div>
          <Label className="text-[11px]">Nominal (Rp)</Label>
          <Input className="mt-1" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        </div>
        <div>
          <Label className="text-[11px]">Kategori (Jurnal Sheet)</Label>
          <Select className="mt-1" value={category} onChange={(e) => setCategory(e.target.value)}>
            {Object.entries(CATEGORY_LABELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </Select>
        </div>
        {materials.length > 0 && (
          <div>
            <Label className="text-[11px]">Material (Opsional)</Label>
            <Select className="mt-1" value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
              <option value="">— Tidak terkait material —</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.code} — {m.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div className={materials.length > 0 ? "" : "sm:col-span-2"}>
          <Label className="text-[11px]">Catatan (Opsional)</Label>
          <Textarea className="mt-1" rows={1} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      <Button onClick={submit} disabled={pending || !description || !amount}>
        {pending ? "Menyimpan..." : "Tambah Pembelian"}
      </Button>
      {message && <p className={`text-sm ${success ? "text-emerald-700" : "text-rose-600"}`}>{message}</p>}
    </div>
  );
}
