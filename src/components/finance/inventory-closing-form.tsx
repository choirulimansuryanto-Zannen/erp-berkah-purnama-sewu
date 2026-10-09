"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label, Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "BAHAN_BAKU", label: "Bahan Baku" },
  { value: "BAHAN_SETENGAH_JADI", label: "Bahan Setengah Jadi" },
  { value: "BARANG_JADI", label: "Barang Jadi" },
  { value: "BAHAN_PENDUKUNG", label: "Bahan Pendukung" },
  { value: "PROYEK_DALAM_PENYELESAIAN", label: "Proyek Dalam Penyelesaian" },
];

// Categories with an exact-matching line in Tabel SKU's Account Summary —
// Saldo table, auto-filled from there (see
// /api/finance/company-material-account-summary) instead of typed by
// hand. The other two categories (Bahan Setengah Jadi, Proyek Dalam
// Penyelesaian) have no such match and stay manual.
const AUTO_FILLED_CATEGORIES = new Set(["BAHAN_BAKU", "BAHAN_PENDUKUNG", "BARANG_JADI"]);

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
  const [loadingAuto, setLoadingAuto] = useState(false);
  const [pending, startTransition] = useTransition();

  const years = Array.from({ length: 5 }, (_, i) => currentYear() - 2 + i);
  const isAutoFilled = AUTO_FILLED_CATEGORIES.has(category);

  useEffect(() => {
    if (!isAutoFilled) return;
    let cancelled = false;
    setLoadingAuto(true);
    fetch(`/api/finance/company-material-account-summary?year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((d) => {
        // Guard against out-of-order resolution: if Bulan/Tahun/Kategori
        // changed again before this request landed, a slower earlier
        // fetch could otherwise overwrite a later selection's value.
        if (!cancelled) setAmount(String(d[category] ?? 0));
      })
      .finally(() => {
        if (!cancelled) setLoadingAuto(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year, month, category, isAutoFilled]);

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
          sekaligus &quot;Persediaan Awal&quot; bulan berikutnya pada Laporan HPP. Untuk kategori Bahan Baku, Bahan Pendukung, dan
          Barang Jadi, nilainya otomatis diambil dari Tabel SKU — Account Summary — Saldo (kolom Total Saldo Akhir).
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
            <Select
              className="mt-1"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                if (!AUTO_FILLED_CATEGORIES.has(e.target.value)) setAmount("");
              }}
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Nilai Persediaan Akhir (Rp)</Label>
            {isAutoFilled ? (
              <>
                <Input className="mt-1 bg-slate-50 text-slate-500" type="text" value={loadingAuto ? "Memuat..." : currency.format(Number(amount || 0))} disabled readOnly />
                <p className="mt-1 text-[11px] text-slate-400">Otomatis dari Account Summary — Saldo</p>
              </>
            ) : (
              <Input className="mt-1" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
            )}
          </div>
          <div className="sm:col-span-4">
            <Label>Catatan (Opsional)</Label>
            <Textarea className="mt-1" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Contoh: Hasil opname gudang pusat, dihitung 30 September 2026" />
          </div>
        </div>

        <Button onClick={submit} disabled={pending || !amount || loadingAuto} className="mt-4">
          {pending ? "Menyimpan..." : "Simpan Persediaan Akhir"}
        </Button>
        {message && <p className={`mt-2 text-sm ${success ? "text-emerald-700" : "text-rose-600"}`}>{message}</p>}
      </CardContent>
    </Card>
  );
}
