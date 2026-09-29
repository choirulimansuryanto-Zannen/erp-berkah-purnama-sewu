"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label, Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function slugify(label: string): string {
  return label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const OVERHEAD_GROUP_LABELS: Record<string, string> = {
  DIRECT: "Overhead Langsung",
  INDIRECT: "Overhead Tidak Langsung",
  NONE: "Bukan Biaya (masuk Pembelian)",
};

export function CreateExpenseCategoryForm() {
  const [label, setLabel] = useState("");
  const [overheadGroup, setOverheadGroup] = useState("INDIRECT");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const key = slugify(label);
      const res = await fetch("/api/admin/expense-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, label, overheadGroup }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Kategori dibuat: ${label}`);
        setLabel("");
        window.location.reload();
      } else {
        setMessage(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tambah Kategori Pengeluaran</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid max-w-lg gap-3 sm:grid-cols-2">
          <div>
            <Label>Nama Kategori</Label>
            <Input className="mt-1" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Contoh: Biaya Parkir" />
          </div>
          <div>
            <Label>Kelompok (Akun Sheet)</Label>
            <Select className="mt-1" value={overheadGroup} onChange={(e) => setOverheadGroup(e.target.value)}>
              {Object.entries(OVERHEAD_GROUP_LABELS).map(([g, l]) => (
                <option key={g} value={g}>
                  {l}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <Button onClick={submit} disabled={pending || !label} className="mt-4">
          {pending ? "Menyimpan..." : "Tambah Kategori"}
        </Button>
        {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
      </CardContent>
    </Card>
  );
}
