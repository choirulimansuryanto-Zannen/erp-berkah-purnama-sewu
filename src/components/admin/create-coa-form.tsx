"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label, Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ACCOUNT_TYPE_LABELS } from "@/lib/accounting-labels";

const TYPES = Object.keys(ACCOUNT_TYPE_LABELS) as (keyof typeof ACCOUNT_TYPE_LABELS)[];

export function CreateCoaForm({ parentOptions }: { parentOptions: { id: string; code: string; name: string }[] }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("ASET");
  const [normalBalance, setNormalBalance] = useState<"DEBIT" | "KREDIT">("DEBIT");
  const [parentId, setParentId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await fetch("/api/admin/chart-of-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name, type, normalBalance, parentId: parentId || null }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Akun dibuat: ${code} — ${name}`);
        setCode("");
        setName("");
        window.location.reload();
      } else {
        setMessage(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tambah Akun Baru</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <Label>Kode Akun</Label>
            <Input className="mt-1" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Contoh: 7950" />
          </div>
          <div className="sm:col-span-2">
            <Label>Nama Akun</Label>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Biaya Parkir" />
          </div>
          <div>
            <Label>Tipe</Label>
            <Select className="mt-1" value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {ACCOUNT_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Saldo Normal</Label>
            <Select className="mt-1" value={normalBalance} onChange={(e) => setNormalBalance(e.target.value as "DEBIT" | "KREDIT")}>
              <option value="DEBIT">Debit</option>
              <option value="KREDIT">Kredit</option>
            </Select>
          </div>
          <div className="sm:col-span-2 lg:col-span-5">
            <Label>Induk Akun (Opsional)</Label>
            <Select className="mt-1" value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">— Tidak ada (akun utama) —</option>
              {parentOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <Button onClick={submit} disabled={pending || !code || !name} className="mt-4">
          {pending ? "Menyimpan..." : "Tambah Akun"}
        </Button>
        {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
      </CardContent>
    </Card>
  );
}
