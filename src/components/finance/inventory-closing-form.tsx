"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label, Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "BAHAN_BAKU", label: "Bahan Baku" },
  { value: "BAHAN_SETENGAH_JADI", label: "Bahan Setengah Jadi" },
  { value: "BARANG_JADI", label: "Barang Jadi" },
  { value: "BAHAN_PENDUKUNG", label: "Bahan Pendukung" },
  { value: "PROYEK_DALAM_PENYELESAIAN", label: "Proyek Dalam Penyelesaian" },
];

function currentYear(): number {
  return new Date().getFullYear();
}
function currentMonth(): number {
  return new Date().getMonth() + 1;
}

// Persediaan Akhir — the periodic-inventory closing figure a physical
// stock-opname produces at month-end. Submitting the same (tahun, bulan,
// kategori) again replaces the previous figure (see the upsert in the API
// route), so correcting a typo is just re-submitting.
export function InventoryClosingForm() {
  const router = useRouter();
  const [year, setYear] = useState(currentYear());
  const [month, setMonth] = useState(currentMonth());
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0].value);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  const years = Array.from({ length: 5 }, (_, i) => currentYear() - 2 + i);

  function submit() {
    setSuccess(false);
    startTransition(async () => {
      const res = await fetch("/api/finance/inventory-closing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month, category, amount: Number(amount), note: note || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Persediaan Akhir ${MONTH_NAMES[month - 1]} ${year} tersimpan.`);
        setSuccess(true);
        setAmount("");
        setNote("");
        router.refresh();
      } else {
        setMessage(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Input Persediaan Akhir (Stock Opname)</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-slate-500">
          Diisi tiap tutup bulan berdasarkan hasil hitung fisik. Nilai ini menjadi &quot;Persediaan Akhir&quot; bulan berjalan
          sekaligus &quot;Persediaan Awal&quot; bulan berikutnya pada Laporan HPP.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Bulan</Label>
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
          <div>
            <Label>Kategori</Label>
            <Select className="mt-1" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Nilai Persediaan Akhir (Rp)</Label>
            <Input className="mt-1" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          </div>
          <div className="sm:col-span-4">
            <Label>Catatan (Opsional)</Label>
            <Textarea className="mt-1" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Contoh: Hasil opname gudang pusat, dihitung 30 September 2026" />
          </div>
        </div>

        <Button onClick={submit} disabled={pending || !amount} className="mt-4">
          {pending ? "Menyimpan..." : "Simpan Persediaan Akhir"}
        </Button>
        {message && <p className={`mt-2 text-sm ${success ? "text-emerald-700" : "text-rose-600"}`}>{message}</p>}
      </CardContent>
    </Card>
  );
}
