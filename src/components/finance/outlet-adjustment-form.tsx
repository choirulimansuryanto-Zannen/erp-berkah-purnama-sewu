"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Label, Input, Textarea, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const TYPE_LABELS: Record<string, string> = {
  RUSAK: "Barang Rusak",
  REJECT: "Barang Reject",
  SELISIH: "Barang Selisih",
  KELUAR: "Barang Keluar (Mutasi)",
};

export function OutletAdjustmentDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function remove() {
    if (!window.confirm("Hapus data adjustment ini?")) return;
    startTransition(async () => {
      const res = await fetch(`/api/finance/outlet-adjustments/${id}`, { method: "DELETE" });
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

// Adjustment Sheet input — Barang Rusak / Barang Reject / Barang Selisih,
// each optionally tied to a material from the Inventory Sheet's catalog so
// it feeds that sheet's Keluar column automatically.
export function OutletAdjustmentForm({
  outletId,
  materials = [],
}: {
  outletId: string;
  materials?: { id: string; code: string; name: string; unit: string }[];
}) {
  const router = useRouter();
  const [date, setDate] = useState(todayStr());
  const [type, setType] = useState("RUSAK");
  const [materialId, setMaterialId] = useState("");
  const [description, setDescription] = useState("");
  const [qty, setQty] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    setSuccess(false);
    startTransition(async () => {
      const res = await fetch("/api/finance/outlet-adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outletId,
          date,
          type,
          materialId: materialId || undefined,
          description,
          qty: Number(qty) || 0,
          amount: Number(amount) || 0,
          note: note || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage("Adjustment tersimpan.");
        setSuccess(true);
        setDescription("");
        setQty("");
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
        <div>
          <Label className="text-[11px]">Jenis</Label>
          <Select className="mt-1" value={type} onChange={(e) => setType(e.target.value)}>
            {Object.entries(TYPE_LABELS).map(([k, l]) => (
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
        <div className="sm:col-span-2">
          <Label className="text-[11px]">Deskripsi</Label>
          <Input className="mt-1" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Contoh: Daging basi 2 pack" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <Label className="text-[11px]">Qty</Label>
          <Input className="mt-1" type="number" min="0" step="0.01" value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>
        <div>
          <Label className="text-[11px]">Nominal (Rp)</Label>
          <Input className="mt-1" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        </div>
        <div>
          <Label className="text-[11px]">Catatan (Opsional)</Label>
          <Textarea className="mt-1" rows={1} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      <Button onClick={submit} disabled={pending || !description}>
        {pending ? "Menyimpan..." : "Tambah Adjustment"}
      </Button>
      {message && <p className={`text-sm ${success ? "text-emerald-700" : "text-rose-600"}`}>{message}</p>}
    </div>
  );
}
