"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/card";
import { Label, Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { useEditDate } from "@/components/setoran/edit-date-context";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("id-ID");
const timeLabelFormat = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" });
const dateLabelFormat = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" });

function formatPeriod(from: string, to: string): string {
  const a = dateLabelFormat.format(new Date(`${from}T00:00:00`));
  if (from === to) return a;
  const b = dateLabelFormat.format(new Date(`${to}T00:00:00`));
  return `${a} – ${b}`;
}

const ONLINE_CASHLESS_FIELDS = [
  { key: "gofoodAmount", label: "GO FOOD" },
  { key: "grabAmount", label: "GRAB FOOD" },
  { key: "shopeeAmount", label: "SHOPEE FOOD" },
  { key: "tiktokAmount", label: "TIKTOK" },
  { key: "qponAmount", label: "QPON" },
  { key: "cashlessAmount", label: "CASHLESS" },
] as const;

export type ManualEntryKey = (typeof ONLINE_CASHLESS_FIELDS)[number]["key"] | "qtyKopdes" | "qtyMbg";
export type ManualEntry = Record<ManualEntryKey, number>;

export type KasbonRow = {
  id: string;
  amount: number;
  notes: string | null;
  date: string;
  pramuniagaName: string;
  outletName: string;
  regionName: string;
};
export type CategoryRow = { category: string; label: string; amount: number };
export type CategoryOption = { key: string; label: string };
export type ExpenseRow = {
  id: string;
  category: string;
  categoryLabel: string;
  amount: number;
  description: string | null;
  approvalStatus: string;
  createdAt: string;
};

// Solid black section header + gold badge, matching every "table N" block in
// the mockup.
function SectionHeader({ title, badge }: { title: string; badge: string }) {
  return (
    <div className="flex items-center justify-between rounded-t-xl bg-brand-950 px-5 py-3.5">
      <p className="text-sm font-bold uppercase tracking-wide text-white">{title}</p>
      <span className="text-xs font-bold uppercase tracking-wide text-gold-400">{badge}</span>
    </div>
  );
}

function TotalRow({ colSpan, label, value }: { colSpan: number; label: string; value: number }) {
  return (
    <tr className="border-t-2 border-slate-300">
      <td colSpan={colSpan} className="rounded-bl-xl bg-amber-400 px-5 py-3 text-right text-sm font-bold text-brand-950">
        {label}
      </td>
      <td className="rounded-br-xl bg-amber-400 px-5 py-3 text-right text-sm font-bold text-brand-950">{number.format(value)}</td>
    </tr>
  );
}

// Rp-nominal inputs display with thousand separators (1.216.600) — a plain
// type="number" input can't show dots (the browser rejects the formatted
// string as invalid), so this is a text input that reformats on every
// keystroke while the value it reports upward stays a plain digit string.
function FormattedNumberInput({
  value,
  onChange,
  onBlur,
  className,
  placeholder = "0",
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  className?: string;
  placeholder?: string;
}) {
  const digitsOnly = value.replace(/\D/g, "");
  const display = digitsOnly ? number.format(Number(digitsOnly)) : "";
  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
      onBlur={onBlur}
      placeholder={placeholder}
      className={cn(
        "field-glow w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm",
        "placeholder:text-slate-400 focus:border-accent-500 focus:outline-none",
        className,
      )}
    />
  );
}

// Sections 2–5 of the Summary Setoran Outlet page (Table 1, the mirrored
// stock form, and the final Rekap Summary live in the parent page — this
// component owns only the moved-from-Expenses content: Online & Cashless,
// Potongan Penjualan, Kasbon, and Operasional Outlet).
export function ExpensesSections({
  outletName,
  regionName,
  rosterOptions,
  manualEntry: initialManualEntry,
  kopdesRate,
  mbgRate,
  promoAmount,
  categories,
  kasbonList,
  kasbonTotal,
  categoryBreakdown,
  operationalTotal,
  expenseHistory,
  rangeFrom,
  rangeTo,
  todayStr,
}: {
  outletName: string;
  regionName: string;
  /** Roster members checked in at this outlet today — who a kasbon can be attributed to. */
  rosterOptions: { id: string; name: string }[];
  manualEntry: ManualEntry;
  kopdesRate: number;
  mbgRate: number;
  promoAmount: number;
  categories: CategoryOption[];
  kasbonList: KasbonRow[];
  kasbonTotal: number;
  categoryBreakdown: CategoryRow[];
  operationalTotal: number;
  expenseHistory: ExpenseRow[];
  rangeFrom: string;
  rangeTo: string;
  todayStr: string;
}) {
  const router = useRouter();
  const editDate = useEditDate();
  const [manualValues, setManualValues] = useState<Record<ManualEntryKey, string>>(
    Object.fromEntries(Object.entries(initialManualEntry).map(([k, v]) => [k, v ? String(v) : ""])) as Record<
      ManualEntryKey,
      string
    >,
  );
  const [savePending, startSave] = useTransition();
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  function setManualField(key: ManualEntryKey, value: string) {
    setManualValues((prev) => ({ ...prev, [key]: value }));
  }

  // Auto-saves on blur (tab/click away from a field) — no separate "Simpan"
  // button: the kasir input IS the Online & Cashless / Potongan figure the
  // moment it's entered. Always sends every field currently in state, not
  // just the one that was blurred, so one field's save can't zero out
  // another's not-yet-blurred value.
  function saveManualEntry() {
    startSave(async () => {
      const payload = {
        ...Object.fromEntries(Object.entries(manualValues).map(([k, v]) => [k, Number(v || 0)])),
        date: editDate ?? undefined,
      };
      const res = await fetch("/api/expenses/manual-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setSaveMessage(res.ok ? "Tersimpan otomatis." : "Gagal menyimpan.");
      if (res.ok) router.refresh();
    });
  }

  const onlineCashlessTotal = ONLINE_CASHLESS_FIELDS.reduce((sum, f) => sum + Number(manualValues[f.key] || 0), 0);
  const qtyKopdes = Number(manualValues.qtyKopdes || 0);
  const qtyMbg = Number(manualValues.qtyMbg || 0);
  const kopdesAmount = qtyKopdes * kopdesRate;
  const mbgAmount = qtyMbg * mbgRate;
  const potonganTotal = kopdesAmount + mbgAmount + promoAmount;

  return (
    <div className="space-y-6">
      {/* 2. Online & Cashless — kasir input */}
      <Card className="overflow-hidden p-0">
        <SectionHeader title="2. Pengeluaran Online & Cashless" badge="Input Kasir" />
        <Table>
          <Thead>
            <tr>
              <Th>No.</Th>
              <Th>Pengeluaran Online &amp; Cashless</Th>
              <Th className="text-right">Nominal (Rp.)</Th>
            </tr>
          </Thead>
          <tbody>
            {ONLINE_CASHLESS_FIELDS.map((f, i) => (
              <Tr key={f.key}>
                <Td className="text-slate-400">{i + 1}</Td>
                <Td className="font-semibold text-slate-900">{f.label}</Td>
                <Td className="text-right">
                  <FormattedNumberInput
                    value={manualValues[f.key]}
                    onChange={(v) => setManualField(f.key, v)}
                    onBlur={saveManualEntry}
                    className="ml-auto w-36 text-right"
                  />
                </Td>
              </Tr>
            ))}
          </tbody>
          <tfoot>
            <TotalRow colSpan={2} label="Total Pengeluaran Online & Cashless" value={onlineCashlessTotal} />
          </tfoot>
        </Table>
        <div className="flex items-center gap-2 border-t border-slate-100 px-5 py-2.5">
          <span className="text-[11px] text-slate-400">Tersimpan otomatis setiap kolom diisi.</span>
          {savePending && <span className="text-[11px] text-slate-400">Menyimpan...</span>}
          {!savePending && saveMessage && (
            <span className="flex items-center gap-1 text-[11px] text-emerald-600">
              <Check className="h-3 w-3" /> {saveMessage}
            </span>
          )}
        </div>
      </Card>

      {/* 3. Potongan Penjualan */}
      <PotonganPenjualanCard
        qtyKopdes={manualValues.qtyKopdes}
        qtyMbg={manualValues.qtyMbg}
        onQtyChange={setManualField}
        kopdesRate={kopdesRate}
        mbgRate={mbgRate}
        kopdesAmount={kopdesAmount}
        mbgAmount={mbgAmount}
        promoAmount={promoAmount}
        potonganTotal={potonganTotal}
        onQtyBlur={saveManualEntry}
        onSaved={() => router.refresh()}
      />

      {/* 4. Kasbon */}
      <KasbonCard
        outletName={outletName}
        regionName={regionName}
        rosterOptions={rosterOptions}
        kasbonList={kasbonList}
        kasbonTotal={kasbonTotal}
        onChanged={() => router.refresh()}
      />

      {/* 5. Pengeluaran Operasional Outlet (aggregated) */}
      <Card className="overflow-hidden p-0">
        <SectionHeader title="5. Pengeluaran Operasional Outlet" badge="Rekap" />
        <p className="border-b border-slate-100 px-5 py-2 text-[11px] text-slate-400">
          Periode: {formatPeriod(rangeFrom, rangeTo)}
        </p>
        <Table>
          <Thead>
            <tr>
              <Th>No.</Th>
              <Th>Pengeluaran Operasional Outlet</Th>
              <Th className="text-right">Nominal (Rp.)</Th>
            </tr>
          </Thead>
          <tbody>
            {categoryBreakdown
              .filter((c) => c.amount > 0)
              .map((c, i) => (
                <Tr key={c.category}>
                  <Td className="text-slate-400">{i + 1}</Td>
                  <Td className="font-semibold text-slate-900">{c.label}</Td>
                  <Td className="text-right font-mono text-slate-800">{number.format(c.amount)}</Td>
                </Tr>
              ))}
            {categoryBreakdown.every((c) => c.amount === 0) && (
              <tr>
                <td colSpan={3} className="px-5 py-8 text-center text-sm text-slate-400">
                  Belum ada akun operasional yang tercatat pengeluarannya.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <TotalRow colSpan={2} label="Total Pengeluaran Operasional Outlet" value={operationalTotal} />
          </tfoot>
        </Table>
      </Card>

      {/* Raw entry: add form + chronological history */}
      <ExpenseEntrySection
        categories={categories}
        expenseHistory={expenseHistory}
        rangeFrom={rangeFrom}
        rangeTo={rangeTo}
        todayStr={todayStr}
        onChanged={() => router.refresh()}
      />
    </div>
  );
}

function PotonganPenjualanCard({
  qtyKopdes,
  qtyMbg,
  onQtyChange,
  onQtyBlur,
  kopdesRate,
  mbgRate,
  kopdesAmount,
  mbgAmount,
  promoAmount,
  potonganTotal,
  onSaved,
}: {
  qtyKopdes: string;
  qtyMbg: string;
  onQtyChange: (key: ManualEntryKey, value: string) => void;
  onQtyBlur: () => void;
  kopdesRate: number;
  mbgRate: number;
  kopdesAmount: number;
  mbgAmount: number;
  promoAmount: number;
  potonganTotal: number;
  onSaved: () => void;
}) {
  const [promoInput, setPromoInput] = useState(String(promoAmount || ""));
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const editDate = useEditDate();

  function savePromo() {
    startTransition(async () => {
      const res = await fetch("/api/expenses/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(promoInput || 0), date: editDate ?? undefined }),
      });
      setMessage(res.ok ? "Tersimpan." : "Gagal menyimpan.");
      if (res.ok) onSaved();
    });
  }

  return (
    <Card className="overflow-hidden p-0">
      <SectionHeader title="3. Potongan Penjualan" badge="Input Kasir x Rate" />
      <Table>
        <Thead>
          <tr>
            <Th>No.</Th>
            <Th>Potongan Penjualan</Th>
            <Th className="text-right">Nominal (Rp.)</Th>
          </tr>
        </Thead>
        <tbody>
          <Tr>
            <Td className="align-top text-slate-400">1</Td>
            <Td className="font-semibold text-slate-900">
              Paket Hemat
              <div className="mt-2 space-y-3 font-normal">
                <div>
                  <span className="font-medium text-slate-800">KOPDES</span> = Potongan {currency.format(kopdesRate)} /menu
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-slate-400">Total Laku Paket Kopdes:</span>
                    <Input
                      type="number"
                      min={0}
                      value={qtyKopdes}
                      onChange={(e) => onQtyChange("qtyKopdes", e.target.value)}
                      onBlur={onQtyBlur}
                      className="w-20 text-center"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div>
                  <span className="font-medium text-slate-800">MBG</span> = Potongan {currency.format(mbgRate)} /menu
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-slate-400">Total Laku Paket MBG:</span>
                    <Input
                      type="number"
                      min={0}
                      value={qtyMbg}
                      onChange={(e) => onQtyChange("qtyMbg", e.target.value)}
                      onBlur={onQtyBlur}
                      className="w-20 text-center"
                      placeholder="0"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">Tersimpan otomatis.</p>
              </div>
            </Td>
            <Td className="text-right align-top font-mono text-slate-800">
              <div>{number.format(kopdesAmount)}</div>
              <div className="mt-11">{number.format(mbgAmount)}</div>
            </Td>
          </Tr>
          <Tr>
            <Td className="text-slate-400">2</Td>
            <Td>
              <p className="font-semibold text-slate-900">Promo</p>
              <p className="text-xs text-slate-400">Manual / Diskon Khusus</p>
            </Td>
            <Td className="text-right">
              <div className="flex items-center justify-end gap-2">
                <FormattedNumberInput value={promoInput} onChange={setPromoInput} className="w-32 text-right" />
                <Button size="sm" variant="outline" onClick={savePromo} disabled={pending}>
                  {pending ? "..." : "Simpan"}
                </Button>
              </div>
              {message && <p className="mt-1 text-[11px] text-slate-400">{message}</p>}
            </Td>
          </Tr>
        </tbody>
        <tfoot>
          <TotalRow colSpan={2} label="Total Potongan Penjualan" value={potonganTotal} />
        </tfoot>
      </Table>
    </Card>
  );
}

function KasbonCard({
  outletName,
  regionName,
  rosterOptions,
  kasbonList,
  kasbonTotal,
  onChanged,
}: {
  outletName: string;
  regionName: string;
  rosterOptions: { id: string; name: string }[];
  kasbonList: KasbonRow[];
  kasbonTotal: number;
  onChanged: () => void;
}) {
  const [rosterId, setRosterId] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const editDate = useEditDate();

  function submit() {
    startTransition(async () => {
      const res = await fetch("/api/expenses/kasbon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount),
          notes: notes || undefined,
          pramuniagaRosterId: rosterId,
          date: editDate ?? undefined,
        }),
      });
      if (res.ok) {
        setAmount("");
        setNotes("");
        setMessage(null);
        onChanged();
      } else {
        setMessage("Gagal menyimpan kasbon.");
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await fetch(`/api/expenses/kasbon/${id}`, { method: "DELETE" });
      if (res.ok) onChanged();
    });
  }

  return (
    <Card className="overflow-hidden p-0">
      <SectionHeader title="4. Kasbon" badge="Manual" />
      <div className="grid grid-cols-1 gap-4 border-b border-slate-100 p-5 sm:grid-cols-3 lg:grid-cols-5">
        <div>
          <Label>Nama Pramu</Label>
          <Select className="mt-1" value={rosterId} onChange={(e) => setRosterId(e.target.value)}>
            <option value="">Pilih pramuniaga yang mengajukan</option>
            {rosterOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Outlet</Label>
          <Input className="mt-1" value={outletName} disabled />
        </div>
        <div>
          <Label>Wilayah</Label>
          <Input className="mt-1" value={regionName} disabled />
        </div>
        <div>
          <Label>Nominal Kasbon (Rp)</Label>
          <FormattedNumberInput value={amount} onChange={setAmount} className="mt-1" placeholder="Contoh: 50.000" />
        </div>
        <div>
          <Label>Keterangan</Label>
          <Input className="mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opsional" />
        </div>
        <div className="sm:col-span-3 lg:col-span-5">
          <Button onClick={submit} disabled={pending || !amount || !rosterId} size="sm">
            {pending ? "Menyimpan..." : "+ Tambah Kasbon"}
          </Button>
          {!rosterId && <p className="mt-1.5 text-xs text-slate-400">Pilih pramuniaga yang mengajukan kasbon ini.</p>}
          {message && <p className="mt-1.5 text-xs text-rose-600">{message}</p>}
        </div>
      </div>
      <Table>
        <Thead>
          <tr>
            <Th>Nama Pramu</Th>
            <Th>Outlet</Th>
            <Th>Wilayah</Th>
            <Th className="text-right">Nominal (Rp.)</Th>
            <Th>Keterangan</Th>
            <Th />
          </tr>
        </Thead>
        <tbody>
          {kasbonList.map((k) => (
            <Tr key={k.id}>
              <Td className="font-medium text-slate-900">{k.pramuniagaName}</Td>
              <Td>{k.outletName}</Td>
              <Td>{k.regionName}</Td>
              <Td className="text-right font-mono text-slate-800">{number.format(k.amount)}</Td>
              <Td className="text-slate-500">{k.notes ?? "-"}</Td>
              <Td>
                <button
                  onClick={() => remove(k.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-rose-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </Td>
            </Tr>
          ))}
          {kasbonList.length === 0 && (
            <tr>
              <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-400">
                Belum ada kasbon tercatat.
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <TotalRow colSpan={5} label="Total Kasbon" value={kasbonTotal} />
        </tfoot>
      </Table>
    </Card>
  );
}

function ExpenseEntrySection({
  categories,
  expenseHistory,
  rangeFrom,
  rangeTo,
  todayStr,
  onChanged,
}: {
  categories: CategoryOption[];
  expenseHistory: ExpenseRow[];
  rangeFrom: string;
  rangeTo: string;
  todayStr: string;
  onChanged: () => void;
}) {
  const router = useRouter();
  const editDate = useEditDate();
  const [category, setCategory] = useState(categories[0]?.key ?? "");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [fromInput, setFromInput] = useState(rangeFrom);
  const [toInput, setToInput] = useState(rangeTo);

  // Preserve editDate (if revising a past report) so browsing the expense
  // history's own date range doesn't silently kick the page out of edit mode.
  function showRange() {
    const editSuffix = editDate ? `&editDate=${editDate}` : "";
    router.push(`/setoran?from=${fromInput}&to=${toInput}${editSuffix}`);
  }

  function showToday() {
    router.push(editDate ? `/setoran?editDate=${editDate}` : "/setoran");
  }

  function submit() {
    startTransition(async () => {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, amount: Number(amount), description: notes || undefined, date: editDate ?? undefined }),
      });
      if (res.ok) {
        setAmount("");
        setNotes("");
        setMessage(null);
        onChanged();
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage(typeof data.error === "string" ? data.error : "Gagal menyimpan.");
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (res.ok) onChanged();
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card className="p-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <p className="text-sm font-bold text-slate-900">Catat Pengeluaran Operasional</p>
        </div>
        <div className="mt-4 space-y-3">
          <div>
            <Label>Kategori Operasional ({categories.length} item)</Label>
            <Select className="mt-1" value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Nominal (Rp)</Label>
            <FormattedNumberInput value={amount} onChange={setAmount} className="mt-1" placeholder="Contoh: 15.000" />
          </div>
          <div>
            <Label>Keterangan (Opsional)</Label>
            <Input className="mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Rincian / catatan tambahan..." />
          </div>
          <Button onClick={submit} disabled={pending || !amount || !category} className="w-full" size="lg">
            {pending ? "Menyimpan..." : "+ Tambah Pengeluaran"}
          </Button>
          {message && <p className="text-xs text-rose-600">{message}</p>}
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between bg-brand-950 px-5 py-3.5">
          <p className="text-sm font-bold uppercase tracking-wide text-white">Riwayat Pengeluaran Tercatat</p>
          <span className="text-xs font-bold text-gold-400">{expenseHistory.length} Item</span>
        </div>
        <div className="flex flex-wrap items-end gap-2 border-b border-slate-100 p-4">
          <div>
            <Label className="text-[11px]">Dari Tanggal</Label>
            <Input type="date" value={fromInput} max={todayStr} onChange={(e) => setFromInput(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-[11px]">Sampai Tanggal</Label>
            <Input type="date" value={toInput} max={todayStr} onChange={(e) => setToInput(e.target.value)} className="mt-1" />
          </div>
          <Button variant="secondary" size="sm" onClick={showRange}>
            Tampilkan
          </Button>
          <Button variant="outline" size="sm" onClick={showToday}>
            Hari Ini
          </Button>
        </div>
        <ul className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto">
          {expenseHistory.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{e.categoryLabel}</p>
                <p className="truncate text-xs text-slate-400">
                  {e.description || e.categoryLabel} · {timeLabelFormat.format(new Date(e.createdAt))}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge status={e.approvalStatus} />
                <span className="text-sm font-bold text-rose-600">{currency.format(e.amount)}</span>
                {e.approvalStatus === "PENDING" && (
                  <button
                    onClick={() => remove(e.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-rose-50 text-rose-400 hover:text-rose-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </li>
          ))}
          {expenseHistory.length === 0 && (
            <li className="px-5 py-10 text-center text-sm text-slate-400">Belum ada pengeluaran di tanggal ini.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}
