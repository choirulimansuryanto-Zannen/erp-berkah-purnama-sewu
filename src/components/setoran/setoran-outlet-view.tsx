"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, DollarSign, Calendar, Store, ChevronRight, ArrowUpDown, X, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label, Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StockTable, initialStockValues, computeStockTotalOmset, type StockPreviewLine } from "@/components/reports/stock-table";
import { MaterialGroupTable, initialMaterialValues, type RawMaterialLine } from "@/components/reports/material-group-table";
import {
  ExpensesSections,
  type ManualEntry,
  type CategoryRow,
  type CategoryOption,
  type KasbonRow,
  type ExpenseRow,
} from "@/components/expenses/expenses-outlet-view";
import { EditDateProvider, useEditDate } from "@/components/setoran/edit-date-context";
import { HistoricalReportDetail, type ReportDetail } from "@/components/reports/historical-report-detail";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

type ReportHistoryRow = {
  id: string;
  date: string;
  dateISO: string;
  dateFull: string;
  isSessionDate: boolean;
  shiftLabel: string;
  omset: number;
  summarySetoran: number;
  actualCashCounted: number;
  variance: number;
  status: string;
};

type StockDraftValue = { ambil: number; sisa: number };

// One read-only "field" inside Informasi Outlet — a bordered box (not a real
// <input>, so a status label can sit inside it) showing either the real
// value or a placeholder, with an optional trailing badge/icon.
function InfoField({
  label,
  value,
  placeholder = "-",
  badge,
  icon,
  note,
}: {
  label: string;
  value: string | null;
  placeholder?: string;
  badge?: string;
  icon?: React.ReactNode;
  note?: React.ReactNode;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1.5 flex items-center justify-between gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm">
        <span className={cn("truncate", value ? "font-semibold text-slate-900" : "text-slate-400")}>{value ?? placeholder}</span>
        {(badge || icon) && (
          <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-slate-400">
            {badge}
            {icon}
          </span>
        )}
      </div>
      {note && <p className="mt-1.5 text-xs text-slate-500">{note}</p>}
    </div>
  );
}

// Fresh top-of-page summary: who's on shift, which shift, which outlet, and
// which report date this whole page is filling in for — all sourced from
// the session's own AttendanceRecord rather than re-typed, so Table 1 below
// is never accidentally filled in against the wrong day/person.
export type PramuniagaShiftEntry = { name: string; shift: string };

// Each pramuniaga on shift checks in independently now (own name, own
// shift) — shown as separate rows rather than merged into one field, since
// they may genuinely be on different shifts the same day.
function PramuniagaTeamField({ team }: { team: PramuniagaShiftEntry[] }) {
  return (
    <div className="sm:col-span-2">
      <div className="flex items-center justify-between">
        <Label>Pramuniaga Bertugas</Label>
        <span className="flex items-center gap-1 text-xs font-medium text-slate-400">Terkunci</span>
      </div>
      {team.length > 0 ? (
        <div className="mt-1.5 divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-300 bg-slate-50 text-sm">
          {team.map((t, i) => (
            <div key={`${t.name}-${i}`} className="flex items-center justify-between gap-2 px-3 py-2.5">
              <span className="font-semibold text-slate-900">{t.name}</span>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
                {t.shift}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="mt-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-400">
            Belum ada Absen Masuk
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            Nama diambil dari Absen Masuk tanggal laporan.{" "}
            <Link href="/attendance" className="font-semibold text-accent-700 hover:text-accent-800">
              Absen dulu
            </Link>{" "}
            lalu kembali ke sini.
          </p>
        </>
      )}
    </div>
  );
}

function InformasiOutletCard({
  outletName,
  team,
  dateLabel,
}: {
  outletName: string;
  team: PramuniagaShiftEntry[];
  dateLabel: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <Store className="h-4 w-4 text-accent-600" />
        <h2 className="text-sm font-bold text-brand-900">Informasi Outlet</h2>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <PramuniagaTeamField team={team} />
        <InfoField label="Lokasi Outlet" value={outletName} badge="Terkunci" />
        <InfoField label="Hari & Tanggal" value={dateLabel} icon={<Calendar className="h-3.5 w-3.5" />} />
      </div>
      <p className="mt-4 text-xs text-slate-400">Tanggal dan shift dikunci dari Absen Masuk. Admin tetap dapat mengubah keduanya.</p>
    </Card>
  );
}

// Table 1 — absorbed from Daily Report, which no longer exists for
// pramuniaga (that menu was removed; the route now redirects PRAMUNIAGA
// straight here). This is the functional form itself now, not a mirror of
// anything — Ambil/Sisa still round-trips through DailyReportStockDraft,
// but only this page writes to it anymore. The actual Submit Laporan action
// lives further down the page now, right after the Rekap Summary section it
// naturally follows on from. Controlled by the parent (not local state)
// since Rekap Summary's own "Total Omset Penjualan" reads the same Ambil/
// Sisa values — see totalFisikCash below.
function FormLaporanSection({
  alreadySubmitted,
  stockPreview,
  stockValues,
  onChange,
  onBlurField,
}: {
  alreadySubmitted: boolean;
  stockPreview: StockPreviewLine[];
  stockValues: { ambil: string; sisa: string }[];
  onChange: (index: number, field: "ambil" | "sisa", v: string) => void;
  onBlurField: (index: number) => void;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between rounded-t-xl bg-brand-950 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-white" />
          <p className="text-sm font-bold uppercase tracking-wide text-white">
            1. Tabel Laporan Harian (Penjualan Bahan Baku / Stok)
          </p>
        </div>
      </div>
      {alreadySubmitted ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">
          Laporan hari ini sudah disubmit — tabel stok ini mengikuti data yang sudah dikunci.
        </p>
      ) : stockPreview.length > 0 ? (
        <StockTable lines={stockPreview} values={stockValues} onChange={onChange} onBlurField={onBlurField} />
      ) : (
        <p className="px-5 py-8 text-center text-sm text-slate-400">Belum ada item stok yang dilacak.</p>
      )}
    </Card>
  );
}

// The actual "close out the shift" action — moved here from right under
// Table 1 so it follows the Rekap Summary's "Total Fisik Cash Wajib
// Disetor" banner directly: see the calculated target, then enter what was
// physically counted, right where the comparison is most meaningful.
function SubmitLaporanCard({
  alreadySubmitted,
  initialActualCashCounted,
  initialNotes,
}: {
  alreadySubmitted: boolean;
  initialActualCashCounted: number | null;
  initialNotes: string | null;
}) {
  const [actualCash, setActualCash] = useState(initialActualCashCounted != null ? String(initialActualCashCounted) : "");
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);
  const [pending, startTransition] = useTransition();
  const editDate = useEditDate();
  const router = useRouter();

  function submit() {
    setSucceeded(false);
    startTransition(async () => {
      const res = await fetch("/api/reports/daily-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actualCashCounted: Number(actualCash), notes: notes || undefined, date: editDate ?? undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage(`Laporan tersimpan (status: ${data.status}).`);
        setSucceeded(true);
      } else {
        setMessage(data.error ?? "Gagal submit.");
      }
    });
  }

  // Deliberately NOT inside the submit transition above: router.refresh()
  // re-fetches this whole page's server data (a Promise.all of ~15 queries),
  // which can take several seconds. Calling it inside startTransition made
  // React keep `pending` true for that entire re-fetch, so the button stayed
  // stuck on "Mengirim..." long after the submit itself had already
  // succeeded (the green banner would show while the button looked frozen).
  // Running it as its own effect lets the transition — and the button — go
  // back to normal the moment the submit call itself finishes.
  useEffect(() => {
    if (succeeded) router.refresh();
  }, [succeeded, router]);

  if (alreadySubmitted) {
    return (
      <Card id="submit-laporan">
        <CardContent>
          <p className="text-sm text-slate-500">Laporan ini sudah diverifikasi dan tidak dapat diedit.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id="submit-laporan">
      <CardHeader>
        <CardTitle>{editDate ? "Kirim Ulang ke SPV" : "Submit Laporan"}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <Label>Actual Cash Counted</Label>
            <Input className="mt-1" type="number" value={actualCash} onChange={(e) => setActualCash(e.target.value)} />
          </div>
          <div>
            <Label>Catatan (jika ada variance)</Label>
            <Textarea className="mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <Button onClick={submit} disabled={pending || actualCash === ""}>
            {pending ? "Mengirim..." : editDate ? "Kirim Ulang ke SPV" : "Submit Laporan"}
          </Button>
          {message && !succeeded && <p className="text-sm text-rose-600">{message}</p>}
          {message && succeeded && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {message}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Daging/Sayur/Bahan Baku (Saos & Kemasan) usage tables — moved here from
// Daily Report (not duplicated); Daily Report's Submit Laporan button reads
// qtyUsed from the same persisted draft these save to on blur (see
// DailyReportMaterialDraft), same "whichever page was last edited wins"
// convention as the mirrored stock table above.
function MaterialUsageTables({
  alreadySubmitted,
  materials,
  materialDraft,
}: {
  alreadySubmitted: boolean;
  materials: RawMaterialLine[];
  materialDraft: Record<string, number>;
}) {
  const [materialValues, setMaterialValues] = useState<Record<string, string>>(initialMaterialValues(materials, materialDraft));
  const editDate = useEditDate();

  function saveMaterialField(rawMaterialId: string) {
    const v = materialValues[rawMaterialId];
    fetch("/api/reports/material-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawMaterialId, qtyUsed: Number(v || 0), date: editDate ?? undefined }),
    });
  }

  if (alreadySubmitted || materials.length === 0) return null;

  const daging = materials.filter((m) => m.group === "DAGING");
  const sayur = materials.filter((m) => m.group === "SAYUR");
  const saosKemasan = materials.filter((m) => m.group === "SAOS_KEMASAN");
  const onChange = (id: string, v: string) => setMaterialValues((prev) => ({ ...prev, [id]: v }));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Daging</CardTitle>
        </CardHeader>
        <MaterialGroupTable title="Daging" unitLabel="Ketul" materials={daging} values={materialValues} onChange={onChange} onBlurField={saveMaterialField} />
      </Card>
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Sayur</CardTitle>
        </CardHeader>
        <MaterialGroupTable title="Sayur" unitLabel="Kg" materials={sayur} values={materialValues} onChange={onChange} onBlurField={saveMaterialField} />
      </Card>
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Bahan Baku (Saos & Kemasan)</CardTitle>
        </CardHeader>
        <MaterialGroupTable
          title="Bahan Baku (Saos & Kemasan)"
          unitLabel="Pakai"
          materials={saosKemasan}
          values={materialValues}
          onChange={onChange}
          onBlurField={saveMaterialField}
          underline
        />
      </Card>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <p className="text-sm font-bold uppercase tracking-wide text-amber-900">Catatan Tambahan Outlet</p>
        <ul className="mt-2 space-y-1.5 text-sm text-amber-800">
          <li>
            * Pastikan nilai <strong>Ambil</strong> dan <strong>Sisa</strong> diinput secara teliti saat pergantian shift.
          </li>
          <li>
            * Laku secara otomatis dihitung dari <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">Ambil - Sisa</code>.
          </li>
        </ul>
      </div>
    </div>
  );
}

// Kasbon breakdown shown inside the Rekap card itself — its total is one of
// the deductions in the "Total Fisik Cash" banner below (see totalFisikCash),
// so the cashier can see exactly which kasbon entries make up that deduction.
function KasbonRekapTable({ kasbonList, kasbonTotal }: { kasbonList: KasbonRow[]; kasbonTotal: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-brand-950">
      <div className="bg-white/5 px-4 py-2.5">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-300">
          Rincian Kasbon <span className="font-normal normal-case text-slate-500">(dikurangkan dari Setoran Fisik Cash)</span>
        </p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wide text-slate-400">
            <th className="px-4 py-2 font-semibold">Nama Pramu</th>
            <th className="px-4 py-2 font-semibold">Keterangan</th>
            <th className="px-4 py-2 text-right font-semibold">Nominal (Rp.)</th>
          </tr>
        </thead>
        <tbody>
          {kasbonList.map((k) => (
            <tr key={k.id} className="border-b border-white/5">
              <td className="px-4 py-2 font-medium text-white">{k.pramuniagaName}</td>
              <td className="px-4 py-2 text-slate-400">{k.notes ?? "-"}</td>
              <td className="px-4 py-2 text-right font-mono text-white">{currency.format(k.amount)}</td>
            </tr>
          ))}
          {kasbonList.length === 0 && (
            <tr>
              <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                Belum ada kasbon tercatat.
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-white/10">
            <td colSpan={2} className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wide text-slate-300">
              Total Kasbon
            </td>
            <td className="px-4 py-2.5 text-right font-bold text-amber-400">{currency.format(kasbonTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function RekapStatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "blue" | "gold" | "red";
}) {
  const TONE_CLASSES: Record<string, string> = {
    green: "text-emerald-400",
    blue: "text-sky-400",
    gold: "text-amber-400",
    red: "text-rose-400",
  };
  return (
    <div className="rounded-xl border border-white/10 bg-brand-950 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={cn("mt-1.5 text-lg font-bold", TONE_CLASSES[tone])}>{currency.format(value)}</p>
    </div>
  );
}

const REPORT_STATUS_META: Record<string, { label: string; tone: "green" | "amber" | "rose" }> = {
  APPROVED: { label: "Terverifikasi", tone: "green" },
  PENDING: { label: "Menunggu SPV", tone: "amber" },
  REJECTED: { label: "Ditolak", tone: "rose" },
  REVISION: { label: "Ditolak", tone: "rose" },
};
const REPORT_STATUS_CLASSES: Record<"green" | "amber" | "rose", string> = {
  green: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  rose: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200",
};
const REPORT_ROW_BORDER: Record<"green" | "amber" | "rose", string> = {
  green: "border-l-emerald-400",
  amber: "border-l-amber-400",
  rose: "border-l-rose-400",
};
const SHIFT_TAG_CLASSES: Record<string, string> = {
  "Shift 1": "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200",
  "Shift 2": "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200",
  Fullshift: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
};

const REPORT_FILTERS = [
  { key: "all", label: "Semua", match: () => true, pillClass: "bg-brand-950 text-white border-brand-950" },
  {
    key: "rejected",
    label: "Ditolak",
    match: (s: string) => s === "REJECTED" || s === "REVISION",
    pillClass: "bg-rose-50 text-rose-700 border-rose-200",
  },
  {
    key: "pending",
    label: "Menunggu",
    match: (s: string) => s === "PENDING",
    pillClass: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    key: "verified",
    label: "Terverifikasi",
    match: (s: string) => s === "APPROVED",
    pillClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
] as const;

// Riwayat Setoran, redesigned as a colorful date-grouped list (matching the
// "Laporan Saya" mockup) instead of a plain table — filterable by status,
// sortable, each row expandable for the figures, with a jump-to-edit link
// for today's own report when its status still allows resubmission.
function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

const monthLabelFormat = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" });

function ReportHistoryList({ reportHistory }: { reportHistory: ReportHistoryRow[] }) {
  const [filter, setFilter] = useState<(typeof REPORT_FILTERS)[number]["key"]>("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, ReportDetail | "loading" | "error">>({});

  // Default view is the running calendar month only — older history is
  // opt-in via the date-range picker below, so a pramuniaga isn't scrolling
  // past months of settled reports to find this week's.
  const [showPicker, setShowPicker] = useState(false);
  const [customRange, setCustomRange] = useState<{ from: string; to: string } | null>(null);
  const [pickerFrom, setPickerFrom] = useState("");
  const [pickerTo, setPickerTo] = useState("");

  function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!details[id]) {
      setDetails((prev) => ({ ...prev, [id]: "loading" }));
      fetch(`/api/reports/${id}/detail`)
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((data: ReportDetail) => setDetails((prev) => ({ ...prev, [id]: data })))
        .catch(() => setDetails((prev) => ({ ...prev, [id]: "error" })));
    }
  }

  function applyRange() {
    if (pickerFrom && pickerTo) {
      setCustomRange({ from: pickerFrom, to: pickerTo });
      setShowPicker(false);
    }
  }

  function resetToThisMonth() {
    setCustomRange(null);
    setPickerFrom("");
    setPickerTo("");
    setShowPicker(false);
  }

  const rangeScoped = useMemo(() => {
    if (customRange) return reportHistory.filter((r) => r.dateISO >= customRange.from && r.dateISO <= customRange.to);
    const key = currentMonthKey();
    return reportHistory.filter((r) => r.dateISO.slice(0, 7) === key);
  }, [reportHistory, customRange]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rangeScoped.length, rejected: 0, pending: 0, verified: 0 };
    for (const r of rangeScoped) {
      if (r.status === "REJECTED" || r.status === "REVISION") c.rejected++;
      else if (r.status === "PENDING") c.pending++;
      else if (r.status === "APPROVED") c.verified++;
    }
    return c;
  }, [rangeScoped]);

  const visible = useMemo(() => {
    const activeFilter = REPORT_FILTERS.find((f) => f.key === filter)!;
    const filtered = rangeScoped.filter((r) => activeFilter.match(r.status));
    const sorted = [...filtered]; // already ordered newest-first from the server
    if (sort === "oldest") sorted.reverse();
    return sorted;
  }, [rangeScoped, filter, sort]);

  const rangeLabel = customRange
    ? `${new Date(`${customRange.from}T00:00:00Z`).toLocaleDateString("id-ID")} – ${new Date(`${customRange.to}T00:00:00Z`).toLocaleDateString("id-ID")}`
    : monthLabelFormat.format(new Date());

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
        <div className="flex flex-wrap gap-1.5">
          {REPORT_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-opacity",
                f.pillClass,
                filter === f.key ? "opacity-100 shadow-sm" : "opacity-55 hover:opacity-80",
              )}
            >
              {f.label}
              <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px]">{counts[f.key]}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowPicker((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold",
              customRange ? "border-accent-300 bg-accent-50 text-accent-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
            )}
          >
            <Calendar className="h-3.5 w-3.5" />
            {rangeLabel}
          </button>
          {customRange && (
            <button
              onClick={resetToThisMonth}
              className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              title="Kembali ke bulan ini"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <div className="flex overflow-hidden rounded-lg border border-slate-200">
            <button
              onClick={() => setSort("newest")}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 text-xs font-bold",
                sort === "newest" ? "bg-brand-950 text-white" : "bg-white text-slate-500",
              )}
            >
              <ArrowUpDown className="h-3 w-3" /> Terbaru
            </button>
            <button
              onClick={() => setSort("oldest")}
              className={cn("px-3 py-1.5 text-xs font-bold", sort === "oldest" ? "bg-brand-950 text-white" : "bg-white text-slate-500")}
            >
              Terlama
            </button>
          </div>
        </div>
      </div>

      {showPicker && (
        <div className="flex flex-wrap items-end gap-2 border-b border-slate-100 bg-slate-50/60 p-4">
          <div>
            <Label className="text-[11px]">Dari Tanggal</Label>
            <Input type="date" value={pickerFrom} onChange={(e) => setPickerFrom(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-[11px]">Sampai Tanggal</Label>
            <Input type="date" value={pickerTo} onChange={(e) => setPickerTo(e.target.value)} className="mt-1" />
          </div>
          <Button size="sm" onClick={applyRange} disabled={!pickerFrom || !pickerTo}>
            Terapkan
          </Button>
          <Button size="sm" variant="outline" onClick={resetToThisMonth}>
            Bulan Ini
          </Button>
        </div>
      )}

      <div className="divide-y divide-slate-100">
        {visible.length === 0 && (
          <p className="px-5 py-10 text-center text-sm text-slate-400">Tidak ada laporan pada {rangeLabel} untuk filter ini.</p>
        )}
        {visible.map((r) => {
          const meta = REPORT_STATUS_META[r.status] ?? { label: r.status, tone: "amber" as const };
          const expanded = expandedId === r.id;
          // Any report SPV hasn't locked in yet (still Menunggu, or sent
          // back Ditolak) stays revisable — not only today's own session —
          // so a rejection from days ago can still be corrected and resent.
          const canEdit = r.status !== "APPROVED";
          return (
            <div key={r.id}>
              <div className="bg-slate-50/80 px-5 py-2 text-xs font-semibold text-slate-500">{r.dateFull}</div>
              <button
                onClick={() => toggleExpand(r.id)}
                className={cn(
                  "flex w-full items-center gap-3 border-l-4 px-5 py-3.5 text-left transition-colors hover:bg-slate-50/60",
                  REPORT_ROW_BORDER[meta.tone],
                )}
              >
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold",
                    SHIFT_TAG_CLASSES[r.shiftLabel] ?? "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200",
                  )}
                >
                  {r.shiftLabel}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">
                  {currency.format(r.summarySetoran)}
                </span>
                <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-bold", REPORT_STATUS_CLASSES[meta.tone])}>
                  {meta.label}
                </span>
                <ChevronRight className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", expanded && "rotate-90")} />
              </button>
              {expanded && (
                <>
                  {canEdit && (
                    <div className="border-l-4 border-transparent bg-slate-50/50 px-5 pt-4">
                      <a
                        href={`/setoran?editDate=${r.dateISO}#submit-laporan`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-accent-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-accent-700"
                      >
                        Koreksi &amp; Kirim Ulang ke SPV →
                      </a>
                    </div>
                  )}
                  {details[r.id] === "loading" && (
                    <p className="border-l-4 border-transparent bg-slate-50/50 px-5 py-8 text-center text-sm text-slate-400">Memuat laporan...</p>
                  )}
                  {details[r.id] === "error" && (
                    <p className="border-l-4 border-transparent bg-slate-50/50 px-5 py-8 text-center text-sm text-rose-500">
                      Gagal memuat laporan ini.
                    </p>
                  )}
                  {details[r.id] && typeof details[r.id] === "object" && <HistoricalReportDetail detail={details[r.id] as ReportDetail} />}
                </>
              )}
            </div>
          );
        })}
      </div>
      <p className="border-t border-slate-100 px-5 py-2.5 text-center text-xs text-slate-400">
        Menampilkan {visible.length} dari {rangeScoped.length} laporan · {rangeLabel}
      </p>
    </Card>
  );
}

export function SetoranOutletView({
  outletName,
  regionName,
  pramuniagaName,
  reportTeam,
  sessionDateLabel,
  alreadySubmitted,
  stockPreview,
  stockDraft,
  materials,
  materialDraft,
  manualEntry,
  kopdesRate,
  mbgRate,
  promoAmount,
  categories,
  kasbonList,
  kasbonTotal,
  kasbonRosterOptions,
  categoryBreakdown,
  operationalTotal,
  expenseHistory,
  rangeFrom,
  rangeTo,
  todayStr,
  editDate,
  initialActualCashCounted,
  initialNotes,
  reportHistory,
}: {
  outletName: string;
  regionName: string;
  pramuniagaName: string;
  reportTeam: PramuniagaShiftEntry[];
  sessionDateLabel: string;
  alreadySubmitted: boolean;
  stockPreview: StockPreviewLine[];
  stockDraft: StockDraftValue[];
  materials: RawMaterialLine[];
  materialDraft: Record<string, number>;
  manualEntry: ManualEntry;
  kopdesRate: number;
  mbgRate: number;
  promoAmount: number;
  categories: CategoryOption[];
  kasbonList: KasbonRow[];
  kasbonTotal: number;
  kasbonRosterOptions: { id: string; name: string }[];
  categoryBreakdown: CategoryRow[];
  operationalTotal: number;
  expenseHistory: ExpenseRow[];
  rangeFrom: string;
  rangeTo: string;
  todayStr: string;
  /** Set (to that report's YYYY-MM-DD date) while revising a past
   * PENDING/REJECTED report via `/setoran?editDate=...` instead of the live
   * session — null for the normal, current-session view. */
  editDate: string | null;
  /** The report's own previously-submitted figures, so the resubmit form
   * opens pre-filled instead of blank (and thus not stuck disabled). Only
   * set while editDate is active. */
  initialActualCashCounted: number | null;
  initialNotes: string | null;
  reportHistory: ReportHistoryRow[];
}) {
  // Lifted up from Table 1 (rather than owned inside FormLaporanSection)
  // because Rekap Summary's "Total Omset Penjualan" needs to read the exact
  // same Ambil/Sisa-derived total Table 1 itself displays — see tableOmset.
  const [stockValues, setStockValues] = useState<{ ambil: string; sisa: string }[]>(
    initialStockValues(stockPreview.length, stockDraft),
  );

  function setStockField(index: number, field: "ambil" | "sisa", v: string) {
    setStockValues((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: v } : row)));
  }

  function saveStockField(index: number) {
    const row = stockValues[index];
    fetch("/api/reports/stock-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemIndex: index,
        ambil: Number(row?.ambil || 0),
        sisa: Number(row?.sisa || 0),
        date: editDate ?? undefined,
      }),
    });
  }

  const tableOmset = computeStockTotalOmset(stockPreview, stockValues);

  const onlineCashlessTotal =
    manualEntry.gofoodAmount +
    manualEntry.grabAmount +
    manualEntry.shopeeAmount +
    manualEntry.tiktokAmount +
    manualEntry.qponAmount +
    manualEntry.cashlessAmount;
  const kopdesAmount = manualEntry.qtyKopdes * kopdesRate;
  const mbgAmount = manualEntry.qtyMbg * mbgRate;
  const potonganTotal = kopdesAmount + mbgAmount + promoAmount;
  const totalFisikCash = tableOmset - onlineCashlessTotal - potonganTotal - operationalTotal - kasbonTotal;

  return (
    <EditDateProvider value={editDate}>
    <div className="space-y-6">
      <PageHeader
        title="Laporan Harian"
        description={`Rekonsiliasi kas & pengeluaran outlet | [${regionName.toUpperCase()} AREA] ${outletName.toUpperCase()}`}
      />

      {editDate && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent-300 bg-accent-50 px-4 py-3">
          <p className="text-sm font-semibold text-accent-800">
            Anda sedang mengoreksi laporan tanggal <span className="font-bold">{sessionDateLabel}</span>.
          </p>
          <Link href="/setoran" className="text-xs font-bold text-accent-700 underline hover:text-accent-800">
            Kembali ke laporan hari ini
          </Link>
        </div>
      )}

      <InformasiOutletCard outletName={outletName} team={reportTeam} dateLabel={sessionDateLabel} />

      <FormLaporanSection
        alreadySubmitted={alreadySubmitted}
        stockPreview={stockPreview}
        stockValues={stockValues}
        onChange={setStockField}
        onBlurField={saveStockField}
      />

      <MaterialUsageTables alreadySubmitted={alreadySubmitted} materials={materials} materialDraft={materialDraft} />

      <ExpensesSections
        outletName={outletName}
        regionName={regionName}
        manualEntry={manualEntry}
        kopdesRate={kopdesRate}
        mbgRate={mbgRate}
        promoAmount={promoAmount}
        categories={categories}
        kasbonList={kasbonList}
        kasbonTotal={kasbonTotal}
        rosterOptions={kasbonRosterOptions}
        categoryBreakdown={categoryBreakdown}
        operationalTotal={operationalTotal}
        expenseHistory={expenseHistory}
        rangeFrom={rangeFrom}
        rangeTo={rangeTo}
        todayStr={todayStr}
      />

      {/* Rekap Summary Setoran Shift */}
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-xl bg-brand-950 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-white" />
            <p className="text-sm font-bold uppercase tracking-wide text-white">Rekap Summary Setoran Shift</p>
          </div>
          <span className="text-xs font-bold uppercase tracking-wide text-gold-400">
            Kasir: {pramuniagaName.toUpperCase()} ([{regionName.toUpperCase()} AREA] {outletName.toUpperCase()})
          </span>
        </div>
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <RekapStatCard label="Total Omset Penjualan" value={tableOmset} tone="green" />
            <RekapStatCard label="(-) Total Online & Cashless" value={onlineCashlessTotal} tone="blue" />
            <RekapStatCard label="(-) Total Potongan Penjualan" value={potonganTotal} tone="gold" />
            <RekapStatCard label="(-) Total Operasional Outlet" value={operationalTotal} tone="red" />
          </div>
          <KasbonRekapTable kasbonList={kasbonList} kasbonTotal={kasbonTotal} />
          <div className="rounded-xl border border-amber-300 bg-amber-400 p-5 text-center">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-950">
              Total Fisik Uang Tunai (Cash) Wajib Disetor
            </p>
            <p className="mt-1.5 text-3xl font-bold text-brand-950">{currency.format(totalFisikCash)}</p>
            <p className="mt-1.5 text-[11px] font-medium text-brand-900">
              Calculated = Omset − Online/Cashless − Potongan Penjualan − Operasional − Kasbon
            </p>
          </div>
        </div>
      </Card>

      <SubmitLaporanCard
        alreadySubmitted={alreadySubmitted}
        initialActualCashCounted={initialActualCashCounted}
        initialNotes={initialNotes}
      />

      <div>
        <h2 className="mb-3 text-sm font-bold text-brand-900">Riwayat Setoran</h2>
        <ReportHistoryList reportHistory={reportHistory} />
      </div>
    </div>
    </EditDateProvider>
  );
}
