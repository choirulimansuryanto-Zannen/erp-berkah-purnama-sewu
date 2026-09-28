"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function CreateFreezerMaterialForm({ nextSortOrder }: { nextSortOrder: number }) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [minStock, setMinStock] = useState("10");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await fetch("/api/admin/freezer-materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, unit, sortOrder: nextSortOrder, minStock: Number(minStock || 10) }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Ditambahkan: ${name}`);
        setName("");
        setUnit("");
        setMinStock("10");
        window.location.reload();
      } else {
        setMessage(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tambah Bahan Baku Freezer</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <Label>Nama Barang</Label>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Labanise Small" />
          </div>
          <div>
            <Label>Satuan</Label>
            <Input className="mt-1" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Pcs / Ketul / Pack" />
          </div>
          <div>
            <Label>Batas Tipis (min stock)</Label>
            <Input className="mt-1" type="number" min={0} value={minStock} onChange={(e) => setMinStock(e.target.value)} />
          </div>
        </div>
        <Button onClick={submit} disabled={pending || !name || !unit} className="mt-4">
          {pending ? "Menyimpan..." : "+ Tambah"}
        </Button>
        {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
      </CardContent>
    </Card>
  );
}
