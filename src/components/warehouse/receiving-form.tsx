"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label, Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Product = { id: string; name: string };

export function ReceivingForm({ products }: { products: Product[] }) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [qty, setQty] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await fetch("/api/warehouse/receiving", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          qty: Number(qty),
          lotNumber,
          expiryDate: expiryDate || undefined,
          supplierName: supplierName || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage("Barang masuk tercatat, stok gudang diperbarui.");
        setQty("");
        setLotNumber("");
        setExpiryDate("");
        setSupplierName("");
        window.location.reload();
      } else {
        setMessage(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Terima Barang (Receiving)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Produk</Label>
            <Select className="mt-1" value={productId} onChange={(e) => setProductId(e.target.value)}>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Qty</Label>
            <Input className="mt-1" type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div>
            <Label>Lot Number</Label>
            <Input className="mt-1" value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} />
          </div>
          <div>
            <Label>Expiry Date (opsional)</Label>
            <Input className="mt-1" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Supplier (opsional)</Label>
            <Input className="mt-1" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
          </div>
        </div>
        <Button onClick={submit} disabled={pending || !productId || !qty || !lotNumber} className="mt-4">
          {pending ? "Menyimpan..." : "Catat Penerimaan"}
        </Button>
        {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
      </CardContent>
    </Card>
  );
}
