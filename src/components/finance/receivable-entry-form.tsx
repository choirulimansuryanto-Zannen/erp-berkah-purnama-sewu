"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label, Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const GROUP_OPTIONS = [
  { value: "OUTLET", label: "Outlet" },
  { value: "MITRA", label: "Mitra" },
  { value: "SAYUR", label: "Sayur" },
  { value: "KOBAR", label: "Kobar" },
  { value: "MANGKACAU", label: "Mangkacau" },
  { value: "TORTILLA", label: "Tortilla" },
  { value: "MIE_STEAK", label: "Mie Steak" },
];

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ReceivableEntryForm() {
  const router = useRouter();
  const [date, setDate] = useState(todayStr());
  const [mitraCode, setMitraCode] = useState("");
  const [mitraName, setMitraName] = useState("");
  const [noFaktur, setNoFaktur] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"debt" | "credit">("debt");
  const [amount, setAmount] = useState("");
  const [group, setGroup] = useState(GROUP_OPTIONS[0].value);
  const [remarks, setRemarks] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    setSuccess(false);
    startTransition(async () => {
      const res = await fetch("/api/finance/receivable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          mitraCode,
          mitraName,
          noFaktur: noFaktur || undefined,
          tglFaktur: date,
          description,
          debt: type === "debt" ? Number(amount) : 0,
          credit: type === "credit" ? Number(amount) : 0,
          remarks: remarks || undefined,
          group,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage("Entri tersimpan.");
        setSuccess(true);
        setAmount("");
        setRemarks("");
        router.refresh();
      } else {
        setMessage(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tambah Entri Piutang</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Tanggal</Label>
            <Input className="mt-1" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Mitra Code</Label>
            <Input className="mt-1" value={mitraCode} onChange={(e) => setMitraCode(e.target.value)} placeholder="ABR-'0004" />
          </div>
          <div>
            <Label>Mitra Name</Label>
            <Input className="mt-1" value={mitraName} onChange={(e) => setMitraName(e.target.value)} placeholder="Kelapa 2" />
          </div>
          <div>
            <Label>No. Faktur</Label>
            <Input className="mt-1" value={noFaktur} onChange={(e) => setNoFaktur(e.target.value)} placeholder="Opsional" />
          </div>
          <div className="sm:col-span-2">
            <Label>Description</Label>
            <Input className="mt-1" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Piutang Mitra" />
          </div>
          <div>
            <Label>Grup</Label>
            <Select className="mt-1" value={group} onChange={(e) => setGroup(e.target.value)}>
              {GROUP_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Jenis</Label>
            <Select className="mt-1" value={type} onChange={(e) => setType(e.target.value as "debt" | "credit")}>
              <option value="debt">Debt (piutang bertambah)</option>
              <option value="credit">Credit (pelunasan)</option>
            </Select>
          </div>
          <div>
            <Label>Nominal (Rp)</Label>
            <Input className="mt-1" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          </div>
          <div className="sm:col-span-2">
            <Label>Remarks</Label>
            <Textarea className="mt-1" rows={1} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Opsional" />
          </div>
        </div>
        <Button onClick={submit} disabled={pending || !amount || !mitraCode || !mitraName || !description} className="mt-4">
          {pending ? "Menyimpan..." : "Simpan Entri"}
        </Button>
        {message && <p className={`mt-2 text-sm ${success ? "text-emerald-700" : "text-rose-600"}`}>{message}</p>}
      </CardContent>
    </Card>
  );
}
