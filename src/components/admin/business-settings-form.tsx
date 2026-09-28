"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { BusinessSettings } from "@/lib/business-settings";

type Field = { key: keyof BusinessSettings; label: string; suffix?: string; min?: number; max?: number };

const SECTIONS: { title: string; hint: string; fields: Field[] }[] = [
  {
    title: "Finance & POS",
    hint: "Ambang approval expense, diskon kasir, jendela pembatalan transaksi, dan variance setoran kas.",
    fields: [
      { key: "expenseAutoApproveLimit", label: "Batas Auto-Approve Expense", suffix: "Rp", min: 0 },
      { key: "posDiscountSpvThresholdPercent", label: "Diskon Butuh Approval SPV di atas", suffix: "%", min: 0, max: 100 },
      { key: "voidWindowMinutes", label: "Jendela Void/Batal Transaksi", suffix: "menit", min: 1 },
      { key: "cashVarianceAutoApprove", label: "Variance Kas Auto-Reconciled hingga", suffix: "Rp", min: 0 },
      { key: "cashVarianceSpvReview", label: "Variance Kas Butuh Review SPV hingga", suffix: "Rp", min: 0 },
    ],
  },
  {
    title: "Loyalty Program",
    hint: "Ambang tier member, multiplier poin per tier, dan rate perolehan/penukaran poin.",
    fields: [
      { key: "memberAnnualSpendWindowDays", label: "Jendela Spend Tahunan (untuk tier)", suffix: "hari", min: 1 },
      { key: "loyaltySilverThreshold", label: "Ambang Tier Silver", suffix: "Rp", min: 0 },
      { key: "loyaltyGoldThreshold", label: "Ambang Tier Gold", suffix: "Rp", min: 0 },
      { key: "loyaltyBronzeMultiplier", label: "Multiplier Poin Bronze", min: 0 },
      { key: "loyaltySilverMultiplier", label: "Multiplier Poin Silver", min: 0 },
      { key: "loyaltyGoldMultiplier", label: "Multiplier Poin Gold", min: 0 },
      { key: "loyaltyPointsPerRupiah", label: "Poin per Rupiah Belanja", min: 0 },
      { key: "loyaltyRupiahPerPointRedeemed", label: "Nilai Tukar per Poin", suffix: "Rp", min: 0 },
    ],
  },
  {
    title: "Inventory & Warehouse",
    hint: "Toleransi selisih stok, ambang eskalasi, dan peringatan kedaluwarsa lot gudang.",
    fields: [
      { key: "stockUnitTolerance", label: "Toleransi Selisih Stok", suffix: "unit", min: 0 },
      { key: "stockPercentTolerance", label: "Toleransi Selisih Stok", suffix: "%", min: 0, max: 100 },
      { key: "inventoryEscalationUnits", label: "Selisih Butuh Eskalasi di atas", suffix: "unit", min: 0 },
      { key: "expiryWarningDays", label: "Peringatan Kedaluwarsa", suffix: "hari sebelum", min: 0 },
    ],
  },
  {
    title: "Operations / Pacing",
    hint: "Jam operasional outlet dan ambang warna status pencapaian omset harian di Executive Dashboard.",
    fields: [
      { key: "businessHourStart", label: "Jam Buka", suffix: "24h", min: 0, max: 23 },
      { key: "businessHourEnd", label: "Jam Tutup", suffix: "24h", min: 0, max: 23 },
      { key: "pacingRedThresholdPercent", label: "Ambang Merah (di bawah)", suffix: "% dari target", min: 0, max: 100 },
      { key: "pacingYellowThresholdPercent", label: "Ambang Kuning (di bawah)", suffix: "% dari target", min: 0, max: 100 },
    ],
  },
  {
    title: "Paket Hemat (Potongan Penjualan)",
    hint: "Nominal potongan otomatis per menu terjual, ditampilkan di halaman Expenses > Potongan Penjualan.",
    fields: [
      { key: "paketHematKopdesDiscount", label: "Potongan Paket Kopdes", suffix: "Rp / menu", min: 0 },
      { key: "paketHematMbgDiscount", label: "Potongan Paket MBG", suffix: "Rp / menu", min: 0 },
    ],
  },
];

export function BusinessSettingsForm({ initial }: { initial: BusinessSettings }) {
  const [settings, setSettings] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function field(key: keyof BusinessSettings, value: string) {
    setSettings((s) => ({ ...s, [key]: Number(value) }));
  }

  function submit() {
    startTransition(async () => {
      const res = await fetch("/api/admin/business-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      setMessage(res.ok ? "Business rules tersimpan." : typeof data.error === "string" ? data.error : "Gagal menyimpan.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Business Rules</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-xs text-slate-500">
          Ambang/threshold di bawah ini langsung memengaruhi perilaku POS, approval expense, rekonsiliasi kas, program
          loyalty, toleransi stok, dan status pencapaian omset — tidak perlu ubah kode untuk menyesuaikannya lagi.
        </p>

        {SECTIONS.map((section) => (
          <div key={section.title}>
            <h3 className="text-sm font-semibold text-brand-900">{section.title}</h3>
            <p className="mt-0.5 text-xs text-slate-400">{section.hint}</p>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {section.fields.map((f) => (
                <div key={f.key}>
                  <Label>
                    {f.label}
                    {f.suffix && <span className="text-slate-400"> ({f.suffix})</span>}
                  </Label>
                  <Input
                    className="mt-1"
                    type="number"
                    min={f.min}
                    max={f.max}
                    step="any"
                    value={settings[f.key]}
                    onChange={(e) => field(f.key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        <div>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Menyimpan..." : "Simpan Business Rules"}
          </Button>
          {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
