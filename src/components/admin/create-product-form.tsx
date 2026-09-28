"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label, Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const CATEGORIES = ["ALACARTE", "PAKET_ONLINE", "PAKET_MBG", "PAKET_KOPDES", "PAKET_PAHLAWAN"] as const;

export function CreateProductForm() {
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("ALACARTE");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku, name, category, price: Number(price), cost: Number(cost) }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Produk dibuat: ${name}`);
        setSku("");
        setName("");
        setPrice("");
        setCost("");
        window.location.reload();
      } else {
        setMessage(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tambah Produk</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <Label>SKU</Label>
            <Input className="mt-1" value={sku} onChange={(e) => setSku(e.target.value)} />
          </div>
          <div className="lg:col-span-2">
            <Label>Nama Produk</Label>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Kategori</Label>
            <Select className="mt-1" value={category} onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replace("_", " ")}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Harga Jual (Rp)</Label>
            <Input className="mt-1" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div>
            <Label>Harga Pokok / HPP (Rp)</Label>
            <Input className="mt-1" type="number" value={cost} onChange={(e) => setCost(e.target.value)} />
          </div>
        </div>
        <Button onClick={submit} disabled={pending || !sku || !name || !price || !cost} className="mt-4">
          {pending ? "Menyimpan..." : "Tambah Produk"}
        </Button>
        {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
      </CardContent>
    </Card>
  );
}
