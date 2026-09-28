"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label, Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Product = { id: string; name: string };

export function DailyCheckForm({ products }: { products: Product[] }) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [opening, setOpening] = useState("0");
  const [received, setReceived] = useState("0");
  const [used, setUsed] = useState("0");
  const [rejected, setRejected] = useState("0");
  const [closing, setClosing] = useState("0");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await fetch("/api/inventory/daily-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          openingBalance: Number(opening),
          received: Number(received),
          used: Number(used),
          rejected: Number(rejected),
          closingBalance: Number(closing),
          varianceReason: reason || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({
          ok: !data.variance_flagged,
          text: data.variance_flagged
            ? "Tersimpan — variance terdeteksi, menunggu review SPV."
            : "Tersimpan — reconciled.",
        });
      } else {
        setMessage({ ok: false, text: typeof data.error === "string" ? data.error : JSON.stringify(data.error) });
      }
    });
  }

  const field = (label: string, value: string, setValue: (v: string) => void) => (
    <div>
      <Label>{label}</Label>
      <Input className="mt-1" type="number" value={value} onChange={(e) => setValue(e.target.value)} />
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Stock Check</CardTitle>
      </CardHeader>
      <CardContent>
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
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {field("Opening", opening, setOpening)}
          {field("Received", received, setReceived)}
          {field("Used", used, setUsed)}
          {field("Rejected", rejected, setRejected)}
          {field("Closing (actual)", closing, setClosing)}
        </div>
        <div className="mt-3">
          <Label>Alasan Variance (jika ada selisih)</Label>
          <Input className="mt-1" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <Button onClick={submit} disabled={pending || !productId} className="mt-4">
          {pending ? "Menyimpan..." : "Simpan Stock Check"}
        </Button>
        {message && (
          <p className={cn("mt-2 text-sm", message.ok ? "text-emerald-600" : "text-amber-700")}>{message.text}</p>
        )}
      </CardContent>
    </Card>
  );
}
