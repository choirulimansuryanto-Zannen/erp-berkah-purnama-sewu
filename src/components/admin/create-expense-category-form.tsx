"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function slugify(label: string): string {
  return label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function CreateExpenseCategoryForm() {
  const [label, setLabel] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const key = slugify(label);
      const res = await fetch("/api/admin/expense-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, label }),
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
        <div className="max-w-sm">
          <Label>Nama Kategori</Label>
          <Input className="mt-1" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Contoh: Biaya Parkir" />
        </div>
        <Button onClick={submit} disabled={pending || !label} className="mt-4">
          {pending ? "Menyimpan..." : "Tambah Kategori"}
        </Button>
        {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
      </CardContent>
    </Card>
  );
}
