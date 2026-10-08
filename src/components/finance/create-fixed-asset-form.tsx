"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label, Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const CATEGORY_OPTIONS = [
  { value: "PERALATAN_KANTOR", label: "Peralatan Kantor", defaultLifeMonths: 48 },
  { value: "PERALATAN_PABRIK", label: "Peralatan Pabrik", defaultLifeMonths: 48 },
  { value: "KENDARAAN", label: "Kendaraan", defaultLifeMonths: 48 },
  { value: "BANGUNAN_KANTOR", label: "Bangunan Kantor", defaultLifeMonths: 240 },
  { value: "BANGUNAN_PABRIK", label: "Bangunan Pabrik", defaultLifeMonths: 240 },
];

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// Tambah Aset Tetap baru — kategori Peralatan/Kendaraan default disusutkan
// 4 tahun (48 bulan), Bangunan default 20 tahun (240 bulan); keduanya bisa
// diubah manual per aset sebelum disimpan.
export function CreateFixedAssetForm() {
  const router = useRouter();
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0].value);
  const [description, setDescription] = useState("");
  const [acquisitionAmount, setAcquisitionAmount] = useState("");
  const [depreciableBase, setDepreciableBase] = useState("");
  const [usefulLifeMonths, setUsefulLifeMonths] = useState(String(CATEGORY_OPTIONS[0].defaultLifeMonths));
  const [acquisitionDate, setAcquisitionDate] = useState(todayStr());
  const [remark, setRemark] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  function onCategoryChange(value: string) {
    setCategory(value);
    const opt = CATEGORY_OPTIONS.find((c) => c.value === value);
    if (opt) setUsefulLifeMonths(String(opt.defaultLifeMonths));
  }

  function submit() {
    setSuccess(false);
    startTransition(async () => {
      const res = await fetch("/api/finance/fixed-asset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          description,
          acquisitionAmount: Number(acquisitionAmount),
          depreciableBase: Number(depreciableBase || acquisitionAmount),
          usefulLifeMonths: Number(usefulLifeMonths),
          acquisitionDate,
          remark: remark || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Aset "${description}" tersimpan.`);
        setSuccess(true);
        setDescription("");
        setAcquisitionAmount("");
        setDepreciableBase("");
        setRemark("");
        router.refresh();
      } else {
        setMessage(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tambah Aset Tetap</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Kategori</Label>
            <Select className="mt-1" value={category} onChange={(e) => onCategoryChange(e.target.value)}>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="sm:col-span-2 lg:col-span-2">
            <Label>Nama Aset</Label>
            <Input className="mt-1" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Contoh: Laptop Acer Baru" />
          </div>
          <div>
            <Label>Tanggal Perolehan</Label>
            <Input className="mt-1" type="date" value={acquisitionDate} onChange={(e) => setAcquisitionDate(e.target.value)} max={todayStr()} />
          </div>
          <div>
            <Label>Acquisition Amount (Rp)</Label>
            <Input className="mt-1" type="number" min="0" value={acquisitionAmount} onChange={(e) => setAcquisitionAmount(e.target.value)} placeholder="0" />
          </div>
          <div>
            <Label>Dasar Penyusutan / PT (Rp)</Label>
            <Input
              className="mt-1"
              type="number"
              min="0"
              value={depreciableBase}
              onChange={(e) => setDepreciableBase(e.target.value)}
              placeholder="Kosongkan = sama dengan Acquisition Amount"
            />
          </div>
          <div>
            <Label>Masa Manfaat (bulan)</Label>
            <Input className="mt-1" type="number" min="1" value={usefulLifeMonths} onChange={(e) => setUsefulLifeMonths(e.target.value)} />
            <p className="mt-1 text-[11px] text-slate-400">Default: 48 bulan (4 tahun) untuk Peralatan/Kendaraan, 240 bulan (20 tahun) untuk Bangunan.</p>
          </div>
          <div className="sm:col-span-2">
            <Label>Remark (Opsional)</Label>
            <Textarea className="mt-1" rows={1} value={remark} onChange={(e) => setRemark(e.target.value)} />
          </div>
        </div>
        <Button onClick={submit} disabled={pending || !description || !acquisitionAmount} className="mt-4">
          {pending ? "Menyimpan..." : "Tambah Aset"}
        </Button>
        {message && <p className={`mt-2 text-sm ${success ? "text-emerald-700" : "text-rose-600"}`}>{message}</p>}
      </CardContent>
    </Card>
  );
}
