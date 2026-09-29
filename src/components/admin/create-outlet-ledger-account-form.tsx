"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label, Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function CreateOutletLedgerAccountForm() {
  const [number, setNumber] = useState("");
  const [label, setLabel] = useState("");
  const [defaultSide, setDefaultSide] = useState("D");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await fetch("/api/admin/outlet-ledger-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: Number(number), label, defaultSide }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Akun dibuat: ${number} — ${label}`);
        setNumber("");
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
        <CardTitle>Tambah Akun — Akun Sheet</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <Label>No. Akun</Label>
            <Input className="mt-1" type="number" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Contoh: 43" />
          </div>
          <div className="sm:col-span-2">
            <Label>Nama Akun</Label>
            <Input className="mt-1" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Contoh: Penjualan Produk (Alfagift)" />
          </div>
          <div>
            <Label>Default D/C</Label>
            <Select className="mt-1" value={defaultSide} onChange={(e) => setDefaultSide(e.target.value)}>
              <option value="D">D (Debit)</option>
              <option value="C">C (Kredit)</option>
            </Select>
          </div>
        </div>
        <Button onClick={submit} disabled={pending || !number || !label} className="mt-4">
          {pending ? "Menyimpan..." : "Tambah Akun"}
        </Button>
        {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
      </CardContent>
    </Card>
  );
}
