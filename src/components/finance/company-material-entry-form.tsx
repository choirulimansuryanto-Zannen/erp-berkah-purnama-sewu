"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label, Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

type MaterialOption = { id: string; code: string; name: string; categoryLabel: string };

// Entri Qty & Harga per SKU — Periode/Tahun/Item bisa dipilih bebas (tidak
// terikat ke filter tabel di bawahnya), Nominal dihitung otomatis dari
// Qty × Harga oleh server (src/lib/company-material.ts), tidak diinput
// manual di sini.
export function CompanyMaterialEntryForm({ materials, defaultYear, defaultMonth }: { materials: MaterialOption[]; defaultYear: number; defaultMonth: number }) {
  const router = useRouter();
  const [year, setYear] = useState(defaultYear);
  const [month, setMonth] = useState(defaultMonth);
  const [materialId, setMaterialId] = useState(materials[0]?.id ?? "");
  const [qtyOpname, setQtyOpname] = useState("");
  const [costPerUnit, setCostPerUnit] = useState("");
  const [fakturOutletQty, setFakturOutletQty] = useState("");
  const [fakturOutletNominal, setFakturOutletNominal] = useState("");
  const [adjustmentFakturQty, setAdjustmentFakturQty] = useState("");
  const [adjustmentFakturNominal, setAdjustmentFakturNominal] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  function submit() {
    setSuccess(false);
    startTransition(async () => {
      const res = await fetch("/api/finance/company-material", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialId,
          year,
          month,
          qtyOpname: Number(qtyOpname || 0),
          costPerUnit: Number(costPerUnit || 0),
          fakturOutletQty: Number(fakturOutletQty || 0),
          fakturOutletNominal: Number(fakturOutletNominal || 0),
          adjustmentFakturQty: Number(adjustmentFakturQty || 0),
          adjustmentFakturNominal: Number(adjustmentFakturNominal || 0),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Tersimpan — ${MONTH_NAMES[month - 1]} ${year}.`);
        setSuccess(true);
        router.refresh();
      } else {
        setMessage(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Input Qty &amp; Harga per Item (SKU)</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-slate-500">
          Pilih Periode, Tahun, dan Item bebas — Nominal dihitung otomatis dari Qty × Harga. Mengisi ulang item/periode yang sama menimpa (replace) nilai sebelumnya.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <div>
            <Label>Periode (Bulan)</Label>
            <Select className="mt-1" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Tahun</Label>
            <Select className="mt-1" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Item (SKU)</Label>
            <Select className="mt-1" value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  [{m.code}] {m.name} — {m.categoryLabel}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <Label>Qty Saldo Akhir</Label>
            <Input className="mt-1" type="number" step="any" value={qtyOpname} onChange={(e) => setQtyOpname(e.target.value)} placeholder="0" />
          </div>
          <div>
            <Label>Harga / Cost Satuan</Label>
            <Input className="mt-1" type="number" step="any" value={costPerUnit} onChange={(e) => setCostPerUnit(e.target.value)} placeholder="0" />
          </div>
          <div>
            <Label>Qty Faktur Outlet</Label>
            <Input className="mt-1" type="number" step="any" value={fakturOutletQty} onChange={(e) => setFakturOutletQty(e.target.value)} placeholder="0" />
          </div>
          <div>
            <Label>Nominal Faktur Outlet</Label>
            <Input className="mt-1" type="number" step="any" value={fakturOutletNominal} onChange={(e) => setFakturOutletNominal(e.target.value)} placeholder="0" />
          </div>
          <div>
            <Label>Qty Adjustment</Label>
            <Input className="mt-1" type="number" step="any" value={adjustmentFakturQty} onChange={(e) => setAdjustmentFakturQty(e.target.value)} placeholder="0" />
          </div>
          <div>
            <Label>Nominal Adjustment</Label>
            <Input className="mt-1" type="number" step="any" value={adjustmentFakturNominal} onChange={(e) => setAdjustmentFakturNominal(e.target.value)} placeholder="0" />
          </div>
        </div>

        <Button onClick={submit} disabled={pending || !materialId} className="mt-4">
          {pending ? "Menyimpan..." : "Simpan"}
        </Button>
        {message && <p className={`mt-2 text-sm ${success ? "text-emerald-700" : "text-rose-600"}`}>{message}</p>}
      </CardContent>
    </Card>
  );
}
