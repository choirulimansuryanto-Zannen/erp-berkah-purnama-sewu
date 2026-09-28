"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label, Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Product = { id: string; name: string };

export function CreateVoucherForm({ products }: { products: Product[] }) {
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [rewardProductId, setRewardProductId] = useState(products[0]?.id ?? "");
  const [rewardQty, setRewardQty] = useState("1");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setMessage(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          description: description || undefined,
          rewardProductId,
          rewardQty: Number(rewardQty),
          maxRedemptions: maxRedemptions ? Number(maxRedemptions) : undefined,
          validFrom: validFrom || undefined,
          validUntil: validUntil || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Voucher "${code}" dibuat.`);
        setCode("");
        setDescription("");
        setRewardQty("1");
        setMaxRedemptions("");
        setValidFrom("");
        setValidUntil("");
        window.location.reload();
      } else {
        setMessage(typeof data.error === "string" ? data.error : "Gagal membuat voucher.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Buat Voucher Baru</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <Label>Kode Voucher</Label>
            <Input className="mt-1" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="MERDEKA2026" />
          </div>
          <div>
            <Label>Produk Hadiah</Label>
            <Select className="mt-1" value={rewardProductId} onChange={(e) => setRewardProductId(e.target.value)}>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Qty Hadiah</Label>
            <Input className="mt-1" type="number" min={1} value={rewardQty} onChange={(e) => setRewardQty(e.target.value)} />
          </div>
          <div>
            <Label>Batas Klaim (opsional)</Label>
            <Input
              className="mt-1"
              type="number"
              min={1}
              value={maxRedemptions}
              onChange={(e) => setMaxRedemptions(e.target.value)}
              placeholder="Tanpa batas"
            />
          </div>
          <div>
            <Label>Berlaku Dari (opsional)</Label>
            <Input className="mt-1" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
          </div>
          <div>
            <Label>Berlaku Sampai (opsional)</Label>
            <Input className="mt-1" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </div>
          <div className="col-span-2 sm:col-span-3">
            <Label>Deskripsi (opsional)</Label>
            <Textarea className="mt-1" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Contoh: Hadiah kemerdekaan untuk member setia" />
          </div>
        </div>
        <Button onClick={submit} disabled={pending || !code || !rewardProductId} className="mt-3">
          {pending ? "Membuat..." : "Buat Voucher"}
        </Button>
        {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
      </CardContent>
    </Card>
  );
}
