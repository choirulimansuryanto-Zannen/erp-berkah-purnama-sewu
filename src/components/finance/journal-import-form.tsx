"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Check, AlertTriangle } from "lucide-react";

type Account = { id: string; code: string; name: string; cashBook: string | null };
type ExistingMapping = { keteranganKey: string; contraAccountId: string };

const CASH_BOOKS = ["KASIR", "BRANKAS", "OUTLET", "PETTY_CASH", "BANK_BCA", "BANK_MANDIRI"] as const;
const CASH_BOOK_LABELS: Record<string, string> = {
  KASIR: "Kasir",
  BRANKAS: "Brankas",
  OUTLET: "Kas Outlet",
  PETTY_CASH: "Petty Cash",
  BANK_BCA: "Bank BCA",
  BANK_MANDIRI: "Bank Mandiri",
};
const BULAN_NAMES_ID = [
  "januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus", "september", "oktober", "november", "desember",
];

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

type ParsedRow = {
  rowIndex: number;
  day: number;
  costCentre: string;
  subCost: string;
  code: string;
  keterangan: string;
  dbcr: "DB" | "CR";
  amount: number;
};

function normalizeKeterangan(s: string): string {
  return s.trim().toLowerCase();
}

function cellText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && "richText" in (value as Record<string, unknown>)) {
    return ((value as { richText: { text: string }[] }).richText || []).map((r) => r.text).join("").trim();
  }
  if (typeof value === "object" && "text" in (value as Record<string, unknown>)) {
    return String((value as { text: unknown }).text).trim();
  }
  return String(value).trim();
}

// Parses an Indonesian-style "1 September 2026" / "1 September" date cell
// into just the day-of-month — the form always targets its OWN chosen
// Tahun/Bulan (same as the business's own "re-input last month's sheet
// into this month" workflow confirmed 2026-10-12), so only the day
// carries over from the file.
function dayFromDateCell(value: unknown): number | null {
  if (value instanceof Date) return value.getUTCDate();
  const text = cellText(value);
  const numMatch = text.match(/^(\d{1,2})\b/);
  if (numMatch) return Number(numMatch[1]);
  return null;
}

// Finds the header row (the one containing both "Tanggal" and
// "Keterangan") and maps each expected column name to its column index —
// tolerant of the exact column order/spacing varying between files,
// since the business's own spreadsheets aren't all byte-identical.
function findHeaderRow(sheet: import("exceljs").Worksheet): { rowNumber: number; cols: Record<string, number> } | null {
  const WANTED: Record<string, RegExp> = {
    tanggal: /tanggal/i,
    costCentre: /cost\s*centre/i,
    subCost: /sub\s*cost/i,
    code: /^code$/i,
    keterangan: /keterangan/i,
    dbcr: /db\s*\/?\s*cr/i,
    nilai: /nilai/i,
  };
  for (let r = 1; r <= Math.min(sheet.rowCount, 30); r++) {
    const row = sheet.getRow(r);
    const texts: Record<number, string> = {};
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      texts[colNumber] = cellText(cell.value);
    });
    const hasTanggal = Object.values(texts).some((t) => WANTED.tanggal.test(t));
    const hasKeterangan = Object.values(texts).some((t) => WANTED.keterangan.test(t));
    if (hasTanggal && hasKeterangan) {
      const cols: Record<string, number> = {};
      for (const [key, re] of Object.entries(WANTED)) {
        const found = Object.entries(texts).find(([, t]) => re.test(t));
        if (found) cols[key] = Number(found[0]);
      }
      return { rowNumber: r, cols };
    }
  }
  return null;
}

async function parseFile(file: File): Promise<ParsedRow[]> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("File tidak punya sheet.");

  const header = findHeaderRow(sheet);
  if (!header || !header.cols.tanggal || !header.cols.keterangan || !header.cols.dbcr || !header.cols.nilai) {
    throw new Error("Format tidak dikenali — pastikan ada kolom Tanggal, Keterangan, DB/CR, dan Nilai.");
  }

  const rows: ParsedRow[] = [];
  for (let r = header.rowNumber + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const dateCell = row.getCell(header.cols.tanggal).value;
    const keteranganCell = cellText(row.getCell(header.cols.keterangan).value);
    const dbcrCell = cellText(row.getCell(header.cols.dbcr).value).toUpperCase();
    const nilaiCell = row.getCell(header.cols.nilai).value;
    const day = dayFromDateCell(dateCell);
    const amount = typeof nilaiCell === "number" ? nilaiCell : Number(cellText(nilaiCell).replace(/[^\d.-]/g, ""));

    // Skip separator/blank rows (no date, or no usable amount) — the
    // source sheets have blank spacer rows between date groups.
    if (!day || !keteranganCell || !amount || !isFinite(amount)) continue;
    if (dbcrCell !== "DB" && dbcrCell !== "CR") continue;

    rows.push({
      rowIndex: r,
      day,
      costCentre: header.cols.costCentre ? cellText(row.getCell(header.cols.costCentre).value) : "",
      subCost: header.cols.subCost ? cellText(row.getCell(header.cols.subCost).value) : "",
      code: header.cols.code ? cellText(row.getCell(header.cols.code).value) : "",
      keterangan: keteranganCell,
      dbcr: dbcrCell as "DB" | "CR",
      amount,
    });
  }
  if (rows.length === 0) throw new Error("Tidak ada baris transaksi yang terbaca dari file ini.");
  return rows;
}

export function JournalImportForm({ accounts, existingMappings }: { accounts: Account[]; existingMappings: ExistingMapping[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cashBook, setCashBook] = useState<string>("BRANKAS");
  const [targetYear, setTargetYear] = useState(String(new Date().getFullYear()));
  const [targetMonth, setTargetMonth] = useState(String(new Date().getMonth() + 1));
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[] | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({}); // normalized keterangan -> accountId
  const [parseError, setParseError] = useState<string | null>(null);
  const [expectedTotalDb, setExpectedTotalDb] = useState("");
  const [expectedTotalCr, setExpectedTotalCr] = useState("");
  const [posting, setPosting] = useState(false);
  const [postResult, setPostResult] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);

  const mappingByKey = useMemo(() => new Map(existingMappings.map((m) => [m.keteranganKey, m.contraAccountId])), [existingMappings]);
  const contraOptions = useMemo(() => accounts, [accounts]);

  const uniqueKeterangan = useMemo(() => {
    if (!parsedRows) return [];
    const seen = new Set<string>();
    const list: string[] = [];
    for (const r of parsedRows) {
      const key = normalizeKeterangan(r.keterangan);
      if (!seen.has(key)) {
        seen.add(key);
        list.push(r.keterangan);
      }
    }
    return list;
  }, [parsedRows]);

  async function handleFile(file: File) {
    setParseError(null);
    setPostResult(null);
    setPostError(null);
    setFileName(file.name);
    try {
      const rows = await parseFile(file);
      setParsedRows(rows);
      // Pre-fill mapping from already-learned JournalImportMapping rows.
      const initial: Record<string, string> = {};
      for (const r of rows) {
        const key = normalizeKeterangan(r.keterangan);
        const known = mappingByKey.get(key);
        if (known) initial[key] = known;
      }
      setMapping(initial);
    } catch (e) {
      setParsedRows(null);
      setParseError(e instanceof Error ? e.message : "Gagal membaca file.");
    }
  }

  const unresolvedCount = uniqueKeterangan.filter((k) => !mapping[normalizeKeterangan(k)]).length;
  const totalDb = (parsedRows ?? []).filter((r) => r.dbcr === "DB").reduce((s, r) => s + r.amount, 0);
  const totalCr = (parsedRows ?? []).filter((r) => r.dbcr === "CR").reduce((s, r) => s + r.amount, 0);
  const dbMismatch = expectedTotalDb.trim() !== "" && Math.round(Number(expectedTotalDb.replace(/\./g, "").replace(",", "."))) !== Math.round(totalDb);
  const crMismatch = expectedTotalCr.trim() !== "" && Math.round(Number(expectedTotalCr.replace(/\./g, "").replace(",", "."))) !== Math.round(totalCr);

  async function postImport() {
    if (!parsedRows) return;
    setPosting(true);
    setPostResult(null);
    setPostError(null);
    try {
      const rows = parsedRows.map((r) => ({
        date: `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(r.day).padStart(2, "0")}`,
        costCentre: r.costCentre || undefined,
        subCost: r.subCost || undefined,
        code: r.code || undefined,
        keterangan: r.keterangan,
        dbcr: r.dbcr,
        amount: r.amount,
        contraAccountId: mapping[normalizeKeterangan(r.keterangan)],
      }));
      const res = await fetch("/api/finance/journal-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cashBook, rows }),
      });
      const data = await res.json();
      if (res.ok) {
        setPostResult(
          `${data.created} jurnal berhasil diposting — setiap jurnal sudah seimbang sendiri (1 baris debit = 1 baris kredit). Total baris bertanda DB di file: ${currency.format(data.totalDebitRows)}, total baris bertanda CR: ${currency.format(data.totalCreditRows)} (dua angka ini wajar berbeda — itu kas masuk vs kas keluar, bukan indikator ketidakseimbangan).`,
        );
        setParsedRows(null);
        setFileName(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        router.refresh();
      } else {
        setPostError(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      }
    } catch {
      setPostError("Gagal mengirim data ke server.");
    } finally {
      setPosting(false);
    }
  }

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-slate-500">Buku Kas</label>
          <select value={cashBook} onChange={(e) => setCashBook(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs">
            {CASH_BOOKS.map((b) => (
              <option key={b} value={b}>
                {CASH_BOOK_LABELS[b]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-slate-500">Tahun Tujuan</label>
          <select value={targetYear} onChange={(e) => setTargetYear(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs">
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-slate-500">Bulan Tujuan</label>
          <select value={targetMonth} onChange={(e) => setTargetMonth(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs">
            {BULAN_NAMES_ID.map((m, i) => (
              <option key={m} value={i + 1}>
                {m[0].toUpperCase() + m.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-slate-500">File Excel (.xlsx)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
          />
        </div>
      </div>
      <p className="text-[11px] text-slate-400">
        Tanggal pada file hanya dipakai tanggal-nya (hari) — bulan &amp; tahun selalu memakai pilihan di atas, jadi satu file bisa dipakai ulang untuk
        periode manapun.
      </p>

      {parseError && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-600">
          <AlertTriangle className="h-3.5 w-3.5" /> {parseError}
        </p>
      )}

      {parsedRows && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-slate-700">
              Pratinjau — {fileName} ({parsedRows.length} baris, {uniqueKeterangan.length} jenis Keterangan unik)
            </p>
            {unresolvedCount > 0 ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">{unresolvedCount} Keterangan belum dipetakan ke akun</span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                <Check className="h-3 w-3" /> Semua sudah terpetakan
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-500">Total DB dari file (opsional, untuk cek)</label>
              <input value={expectedTotalDb} onChange={(e) => setExpectedTotalDb(e.target.value)} placeholder="mis. 359.373.500" className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs" />
              <p className="mt-1 text-[11px] tabular-nums text-slate-500">
                Dihitung dari file: {currency.format(totalDb)} {dbMismatch && <span className="font-bold text-rose-600">⚠ tidak cocok</span>}
              </p>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-500">Total CR dari file (opsional, untuk cek)</label>
              <input value={expectedTotalCr} onChange={(e) => setExpectedTotalCr(e.target.value)} placeholder="mis. 373.409.398" className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs" />
              <p className="mt-1 text-[11px] tabular-nums text-slate-500">
                Dihitung dari file: {currency.format(totalCr)} {crMismatch && <span className="font-bold text-rose-600">⚠ tidak cocok</span>}
              </p>
            </div>
          </div>

          <div className="max-h-[50vh] overflow-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[800px] border-collapse text-xs">
              <thead className="sticky top-0 bg-brand-950 text-white">
                <tr>
                  <th className="px-2 py-1.5 text-left">Keterangan</th>
                  <th className="px-2 py-1.5 text-right">Jumlah Baris</th>
                  <th className="px-2 py-1.5 text-left">Akun Lawan</th>
                </tr>
              </thead>
              <tbody>
                {uniqueKeterangan.map((k) => {
                  const key = normalizeKeterangan(k);
                  const count = parsedRows.filter((r) => normalizeKeterangan(r.keterangan) === key).length;
                  const isKnown = Boolean(mappingByKey.get(key));
                  return (
                    <tr key={key} className={`border-b border-slate-100 ${!mapping[key] ? "bg-amber-50" : ""}`}>
                      <td className="px-2 py-1.5">
                        {k}
                        {isKnown && !mapping[key] && <span className="ml-1 text-[10px] text-slate-400">(sebelumnya dipetakan)</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{count}</td>
                      <td className="px-1 py-1">
                        <select
                          value={mapping[key] ?? ""}
                          onChange={(e) => setMapping((prev) => ({ ...prev, [key]: e.target.value }))}
                          className={`w-full rounded-md border px-2 py-1 text-xs ${!mapping[key] ? "border-amber-400 bg-amber-50" : "border-slate-300 bg-white"}`}
                        >
                          <option value="">— pilih akun —</option>
                          {contraOptions.map((a) => (
                            <option key={a.id} value={a.id}>
                              [{a.code}] {a.name}
                              {a.cashBook ? ` (${CASH_BOOK_LABELS[a.cashBook]} — jadi Transfer Antar Buku)` : ""}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={postImport}
              disabled={posting || unresolvedCount > 0}
              className="flex items-center gap-1.5 rounded-lg bg-brand-900 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Upload className="h-3.5 w-3.5" /> {posting ? "Memposting..." : `Posting ${parsedRows.length} Jurnal`}
            </button>
            {unresolvedCount > 0 && <p className="text-xs text-slate-500">Petakan dulu semua Keterangan di atas sebelum bisa posting.</p>}
          </div>
          {postError && <p className="text-xs font-semibold text-rose-600">{postError}</p>}
        </div>
      )}
      {postResult && <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700"><Check className="h-4 w-4" /> {postResult}</p>}
    </div>
  );
}
