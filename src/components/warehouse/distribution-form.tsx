"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label, Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Product = { id: string; name: string };
type Outlet = { id: string; name: string };

export function DistributionForm({ products, outlets }: { products: Product[]; outlets: Outlet[] }) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [outletId, setOutletId] = useState(outlets[0]?.id ?? "");
  const [qty, setQty] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await fetch("/api/warehouse/distribution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, outletId, qty: Number(qty), lotNumber: lotNumber || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage("Distribusi dijadwalkan.");
        setQty("");
        setLotNumber("");
        window.location.reload();
      } else {
        setMessage(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Distribusi ke Outlet</CardTitle>
      </CardHeader>
      <CardContent>
        {outlets.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada outlet aktif.</p>
        ) : (
          <>
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
                <Label>Outlet Tujuan</Label>
                <Select className="mt-1" value={outletId} onChange={(e) => setOutletId(e.target.value)}>
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Qty</Label>
                <Input className="mt-1" type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
              </div>
              <div>
                <Label>Lot Number (opsional)</Label>
                <Input className="mt-1" value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} />
              </div>
            </div>
            <Button onClick={submit} disabled={pending || !productId || !outletId || !qty} className="mt-4">
              {pending ? "Menyimpan..." : "Jadwalkan Distribusi"}
            </Button>
          </>
        )}
        {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
      </CardContent>
    </Card>
  );
}
