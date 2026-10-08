"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label, Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

type MaterialOption = { id: string; code: string; name: string; categoryLabel: string };

// Entri Qty & Harga per SKU — Periode/Tahun/Item bisa dipilih bebas. Setiap
// kali Item/Periode berganti, nilai yang sudah tersimpan (atau Saldo Awal
// default dari bulan sebelumnya) dimuat otomatis, supaya menyimpan ulang
// tidak diam-diam menimpa field yang tidak dimaksud diubah dengan nol.
// Semua Nominal dihitung server (Qty × Harga), tidak diinput di sini.
export function CompanyMaterialEntryForm({ materials, defaultYear, defaultMonth }: { materials: MaterialOption[]; defaultYear: number; defaultMonth: number }) {
  const router = useRouter();
  const [year, setYear] = useState(defaultYear);
  const [month, setMonth] = useState(defaultMonth);
  const [materialId, setMaterialId] = useState(materials[0]?.id ?? "");
  const [saldoAwalQty, setSaldoAwalQty] = useState("0");
  const [qtyOpname, setQtyOpname] = useState("0");
  const [costPerUnit, setCostPerUnit] = useState("0");
  const [fakturOutletQty, setFakturOutletQty] = useState("0");
  const [totalBahanBakuQty, setTotalBahanBakuQty] = useState("0");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  useEffect(() => {
    if (!materialId) return;
    setLoading(true);
    setMessage(null);
    fetch(`/api/finance/company-material?materialId=${materialId}&year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((d) => {
        setSaldoAwalQty(String(d.saldoAwalQty ?? 0));
        setQtyOpname(String(d.qtyOpname ?? 0));
        setCostPerUnit(String(d.costPerUnit ?? 0));
        setFakturOutletQty(String(d.fakturOutletQty ?? 0));
        setTotalBahanBakuQty(String(d.totalBahanBakuQty ?? 0));
      })
      .finally(() => setLoading(false));
  }, [materialId, year, month]);

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
          saldoAwalQty: Number(saldoAwalQty || 0),
          qtyOpname: Number(qtyOpname || 0),
          costPerUnit: Number(costPerUnit || 0),
          fakturOutletQty: Number(fakturOutletQty || 0),
          totalBahanBakuQty: Number(totalBahanBakuQty || 0),
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

  const cost = Number(costPerUnit || 0);
  const preview = (qty: string) => currency.format(Number(qty || 0) * cost);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Input Qty &amp; Harga per Item (SKU)</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-slate-500">
          Pilih Periode, Tahun, dan Item bebas — nilai yang sudah ada otomatis dimuat (Saldo Awal default dari Saldo Akhir bulan sebelumnya kalau belum
          pernah diisi). Nominal dihitung otomatis dari Qty × Harga, tidak perlu diisi manual.
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

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <Label>Harga / Cost Satuan</Label>
            <Input className="mt-1" type="number" step="any" value={costPerUnit} onChange={(e) => setCostPerUnit(e.target.value)} disabled={loading} />
          </div>
          <div>
            <Label>Qty Saldo Awal</Label>
            <Input className="mt-1" type="number" step="any" value={saldoAwalQty} onChange={(e) => setSaldoAwalQty(e.target.value)} disabled={loading} />
            <p className="mt-1 text-[11px] text-slate-400">Nominal: {preview(saldoAwalQty)}</p>
          </div>
          <div>
            <Label>Qty Saldo Akhir</Label>
            <Input className="mt-1" type="number" step="any" value={qtyOpname} onChange={(e) => setQtyOpname(e.target.value)} disabled={loading} />
            <p className="mt-1 text-[11px] text-slate-400">Nominal: {preview(qtyOpname)}</p>
          </div>
          <div>
            <Label>Qty Faktur Outlet</Label>
            <Input className="mt-1" type="number" step="any" value={fakturOutletQty} onChange={(e) => setFakturOutletQty(e.target.value)} disabled={loading} />
            <p className="mt-1 text-[11px] text-slate-400">Nominal: {preview(fakturOutletQty)}</p>
          </div>
          <div>
            <Label>Qty Total Bahan Baku</Label>
            <Input
              className="mt-1"
              type="number"
              step="any"
              value={totalBahanBakuQty}
              onChange={(e) => setTotalBahanBakuQty(e.target.value)}
              disabled={loading}
            />
            <p className="mt-1 text-[11px] text-slate-400">Nominal: {preview(totalBahanBakuQty)}</p>
          </div>
        </div>

        <Button onClick={submit} disabled={pending || loading || !materialId} className="mt-4">
          {pending ? "Menyimpan..." : loading ? "Memuat..." : "Simpan"}
        </Button>
        {message && <p className={`mt-2 text-sm ${success ? "text-emerald-700" : "text-rose-600"}`}>{message}</p>}
      </CardContent>
    </Card>
  );
}
