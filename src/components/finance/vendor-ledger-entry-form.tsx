"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label, Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Entri Buku Hutang Vendor — append-only, satu baris per kejadian (Hutang
// baru ATAU Bayar, bukan dua-duanya di baris yang sama), ditambahkan ke
// ledger vendor yang dipilih.
export function VendorLedgerEntryForm({ vendors }: { vendors: { id: string; name: string }[] }) {
  const router = useRouter();
  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? "");
  const [date, setDate] = useState(todayStr());
  const [type, setType] = useState<"hutang" | "bayar">("hutang");
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    setSuccess(false);
    startTransition(async () => {
      const res = await fetch("/api/finance/vendor-ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId,
          date,
          hutang: type === "hutang" ? Number(amount) : 0,
          bayar: type === "bayar" ? Number(amount) : 0,
          remarks: remarks || undefined,
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

  if (vendors.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tambah Entri Hutang / Bayar</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <Label>Vendor</Label>
            <Select className="mt-1" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Tanggal</Label>
            <Input className="mt-1" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Jenis</Label>
            <Select className="mt-1" value={type} onChange={(e) => setType(e.target.value as "hutang" | "bayar")}>
              <option value="hutang">Hutang (bertambah)</option>
              <option value="bayar">Bayar (berkurang)</option>
            </Select>
          </div>
          <div>
            <Label>Nominal (Rp)</Label>
            <Input className="mt-1" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          </div>
          <div>
            <Label>Remarks</Label>
            <Textarea className="mt-1" rows={1} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Opsional" />
          </div>
        </div>
        <Button onClick={submit} disabled={pending || !amount || !vendorId} className="mt-4">
          {pending ? "Menyimpan..." : "Simpan Entri"}
        </Button>
        {message && <p className={`mt-2 text-sm ${success ? "text-emerald-700" : "text-rose-600"}`}>{message}</p>}
      </CardContent>
    </Card>
  );
}
