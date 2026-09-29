"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label, Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const CATEGORY_LABELS: Record<string, string> = {
  BAHAN_UTAMA: "Bahan Utama",
  BAHAN_BAKU_TAMBAHAN: "Bahan Baku Tambahan",
  PACKAGING: "Packaging",
  BAHAN_ALAT_PENDUKUNG: "Bahan & Alat Pendukung",
};

export function CreateOutletMaterialForm() {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("BAHAN_UTAMA");
  const [unit, setUnit] = useState("Pcs");
  const [unitPrice, setUnitPrice] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await fetch("/api/admin/outlet-materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name, category, unit, unitPrice: Number(unitPrice) || 0 }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Material dibuat: ${name}`);
        setCode("");
        setName("");
        setUnitPrice("");
        window.location.reload();
      } else {
        setMessage(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tambah Material — Data Stock Available</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-5">
          <div>
            <Label>Kode</Label>
            <Input className="mt-1" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Contoh: 100" />
          </div>
          <div className="sm:col-span-2">
            <Label>Nama Material</Label>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Daging @4Kg" />
          </div>
          <div>
            <Label>Kategori</Label>
            <Select className="mt-1" value={category} onChange={(e) => setCategory(e.target.value)}>
              {Object.entries(CATEGORY_LABELS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Satuan</Label>
            <Input className="mt-1" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Ketul / Pcs / Kg" />
          </div>
          <div>
            <Label>Harga Satuan (Rp)</Label>
            <Input className="mt-1" type="number" min="0" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="0" />
          </div>
        </div>
        <Button onClick={submit} disabled={pending || !code || !name} className="mt-4">
          {pending ? "Menyimpan..." : "Tambah Material"}
        </Button>
        {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
      </CardContent>
    </Card>
  );
}
