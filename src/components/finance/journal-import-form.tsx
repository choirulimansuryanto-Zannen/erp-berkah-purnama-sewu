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
// Normalizes any of the reasonable ways a file might mark a debit/credit
// row — not just the literal "DB"/"CR" the header-detection regex
// already tolerates variants of ("D/K", "Debit/Kredit", ...). Returns
// null for anything unrecognized rather than guessing.
function normalizeDbCr(raw: string): "DB" | "CR" | null {
  const t = raw.trim().toUpperCase();
  if (t === "DB" || t === "D" || t === "DEBIT") return "DB";
  if (t === "CR" || t === "K" || t === "C" || t === "KREDIT" || t === "CREDIT") return "CR";
  return null;
}

function dayFromDateCell(value: unknown): number | null {
  if (value instanceof Date) return value.getUTCDate();
  const text = cellText(value);
  const numMatch = text.match(/^(\d{1,2})\b/);
  if (numMatch) return Number(numMatch[1]);
  return null;
}

// Finds the header row (the one containing both a "Tanggal"-like and a
// "Keterangan"-like column) and maps each expected column name to its
// column index — tolerant of the exact column order/spacing AND of
// reasonable label variants (the business's own spreadsheets aren't all
// byte-identical: a bank-statement sheet might say "Uraian" instead of
// "Keterangan", "D/K" instead of "DB/CR", etc).
const HEADER_PATTERNS: Record<string, RegExp> = {
  tanggal: /tanggal|^tgl\.?$/i,
  costCentre: /cost\s*centre|cost\s*center/i,
  subCost: /sub\s*cost/i,
  code: /^code$/i,
  keterangan: /keterangan|uraian|description|deskripsi|narasi/i,
  dbcr: /d\s*\/?\s*k\b|db\s*\/?\s*cr|debit\s*\/?\s*kredit|debit\s*\/?\s*credit|^(debit|kredit|credit)$/i,
  nilai: /nilai|nominal|jumlah|^amount$|mutasi/i,
};
function findHeaderRow(sheet: import("exceljs").Worksheet): { rowNumber: number; cols: Record<string, number> } | null {
  for (let r = 1; r <= Math.min(sheet.rowCount, 40); r++) {
    const row = sheet.getRow(r);
    const texts: Record<number, string> = {};
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      texts[colNumber] = cellText(cell.value);
    });
    const hasTanggal = Object.values(texts).some((t) => HEADER_PATTERNS.tanggal.test(t));
    const hasKeterangan = Object.values(texts).some((t) => HEADER_PATTERNS.keterangan.test(t));
    if (hasTanggal && hasKeterangan) {
      const cols: Record<string, number> = {};
      for (const [key, re] of Object.entries(HEADER_PATTERNS)) {
        const found = Object.entries(texts).find(([, t]) => re.test(t));
        if (found) cols[key] = Number(found[0]);
      }
      return { rowNumber: r, cols };
    }
  }
  return null;
}

// Dumps the first ~15 rows' cell text (every non-empty worksheet checked)
// so a failed detection's error message shows EXACTLY what the file
// actually contains — the only way to debug a format mismatch for a file
// that can't be attached directly in chat.
function dumpFirstRows(workbook: import("exceljs").Workbook): string {
  const lines: string[] = [];
  for (const sheet of workbook.worksheets) {
    lines.push(`[Sheet "${sheet.name}"]`);
    for (let r = 1; r <= Math.min(sheet.rowCount, 15); r++) {
      const row = sheet.getRow(r);
      const cells: string[] = [];
      row.eachCell({ includeEmpty: false }, (cell) => {
        const t = cellText(cell.value);
        if (t) cells.push(t);
      });
      if (cells.length) lines.push(`  baris ${r}: ${cells.join(" | ")}`);
    }
  }
  return lines.join("\n");
}

async function parseFile(file: File): Promise<ParsedRow[]> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await workbook.xlsx.load(buffer);
  if (workbook.worksheets.length === 0) throw new Error("File tidak punya sheet.");

  // Check every worksheet, not just the first — some files lead with a
  // cover/summary sheet before the actual transaction table.
  let sheet: import("exceljs").Worksheet | null = null;
  let header: { rowNumber: number; cols: Record<string, number> } | null = null;
  for (const ws of workbook.worksheets) {
    const h = findHeaderRow(ws);
    if (h && h.cols.tanggal && h.cols.keterangan && h.cols.dbcr && h.cols.nilai) {
      sheet = ws;
      header = h;
      break;
    }
  }
  if (!sheet || !header) {
    throw new Error(
      `Format tidak dikenali — pastikan ada kolom Tanggal, Keterangan, DB/CR (atau D/K), dan Nilai/Nominal dalam satu baris header.\n\nIsi baris-baris awal file yang terbaca:\n${dumpFirstRows(workbook)}`,
    );
  }

  const rows: ParsedRow[] = [];
  for (let r = header.rowNumber + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const dateCell = row.getCell(header.cols.tanggal).value;
    const keteranganCell = cellText(row.getCell(header.cols.keterangan).value);
    const dbcrCell = normalizeDbCr(cellText(row.getCell(header.cols.dbcr).value));
    const nilaiCell = row.getCell(header.cols.nilai).value;
    const day = dayFromDateCell(dateCell);
    const amount = typeof nilaiCell === "number" ? nilaiCell : Number(cellText(nilaiCell).replace(/[^\d.-]/g, ""));

    // Skip separator/blank rows (no date, or no usable amount) — the
    // source sheets have blank spacer rows between date groups.
    if (!day || !keteranganCell || !amount || !isFinite(amount)) continue;
    if (!dbcrCell) continue;

    rows.push({
      rowIndex: r,
      day,
      costCentre: header.cols.costCentre ? cellText(row.getCell(header.cols.costCentre).value) : "",
      subCost: header.cols.subCost ? cellText(row.getCell(header.cols.subCost).value) : "",
      code: header.cols.code ? cellText(row.getCell(header.cols.code).value) : "",
      keterangan: keteranganCell,
      dbcr: dbcrCell,
      amount,
    });
  }
  if (rows.length === 0) {
    const sampleLines: string[] = [];
    for (let r = header.rowNumber + 1; r <= Math.min(sheet.rowCount, header.rowNumber + 6); r++) {
      const row = sheet.getRow(r);
      const cells: string[] = [];
      row.eachCell({ includeEmpty: false }, (cell) => {
        const t = cellText(cell.value);
        if (t) cells.push(t);
      });
      if (cells.length) sampleLines.push(`  baris ${r}: ${cells.join(" | ")}`);
    }
    throw new Error(
      `Header kolom terbaca di baris ${header.rowNumber}, tapi tidak ada baris data di bawahnya yang valid (perlu Tanggal, Keterangan, DB/CR, dan Nilai terisi semua).\n\nContoh baris yang terbaca:\n${sampleLines.join("\n") || "(tidak ada baris berisi apa pun)"}`,
    );
  }
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
  // Bank-statement-style files routinely have a near-unique Keterangan per
  // row (transaction references, dates, counterparty names baked into the
  // text) — confirmed 2026-10-13 against a real 1881-row file with 1875
  // distinct descriptions, where mapping one-by-one is impractical. The
  // simple, practical default: ONE contra account for every DB row and
  // ONE for every CR row; per-Keterangan mapping becomes an OPTIONAL
  // override for descriptions that actually repeat (a handful, not
  // thousands), not a requirement for every row.
  const [defaultDbAccountId, setDefaultDbAccountId] = useState("");
  const [defaultCrAccountId, setDefaultCrAccountId] = useState("");
  const [showOverrides, setShowOverrides] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postResult, setPostResult] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const [lastBatchId, setLastBatchId] = useState<string | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [undone, setUndone] = useState(false);

  const mappingByKey = useMemo(() => new Map(existingMappings.map((m) => [m.keteranganKey, m.contraAccountId])), [existingMappings]);
  const contraOptions = useMemo(() => accounts, [accounts]);

  // Every distinct Keterangan + how many rows share it, most-frequent
  // first. "Repeating" (count > 1) ones are worth an optional override —
  // the one-off, never-repeated ones (the overwhelming majority in a real
  // bank statement) aren't worth singling out and just use the default.
  const keteranganStats = useMemo(() => {
    if (!parsedRows) return [];
    const counts = new Map<string, { original: string; count: number }>();
    for (const r of parsedRows) {
      const key = normalizeKeterangan(r.keterangan);
      const entry = counts.get(key);
      if (entry) entry.count += 1;
      else counts.set(key, { original: r.keterangan, count: 1 });
    }
    return [...counts.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.count - a.count);
  }, [parsedRows]);
  const repeatingKeterangan = useMemo(() => keteranganStats.filter((k) => k.count > 1).slice(0, 100), [keteranganStats]);

  function resolvedContraFor(r: ParsedRow): string {
    return mapping[normalizeKeterangan(r.keterangan)] || (r.dbcr === "DB" ? defaultDbAccountId : defaultCrAccountId);
  }

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

  const totalDb = (parsedRows ?? []).filter((r) => r.dbcr === "DB").reduce((s, r) => s + r.amount, 0);
  const totalCr = (parsedRows ?? []).filter((r) => r.dbcr === "CR").reduce((s, r) => s + r.amount, 0);
  const hasDbRows = (parsedRows ?? []).some((r) => r.dbcr === "DB");
  const hasCrRows = (parsedRows ?? []).some((r) => r.dbcr === "CR");
  const unresolvedCount = (parsedRows ?? []).filter((r) => !resolvedContraFor(r)).length;
  // Totals are always whole Rupiah in practice — stripping every "." and
  // "," (rather than assuming one is the Indonesian thousands separator)
  // is locale-proof: it reads "620,662,502" (US-style, as pasted from a
  // source that formats that way) exactly the same as "620.662.502"
  // (id-ID style), which a strict id-ID-only parse got wrong and flagged
  // as a false mismatch (found 2026-10-13 against a real file).
  function parseWholeRupiah(s: string): number {
    return Number(s.replace(/[^\d]/g, "")) || 0;
  }
  const dbMismatch = expectedTotalDb.trim() !== "" && parseWholeRupiah(expectedTotalDb) !== Math.round(totalDb);
  const crMismatch = expectedTotalCr.trim() !== "" && parseWholeRupiah(expectedTotalCr) !== Math.round(totalCr);

  async function postImport() {
    if (!parsedRows) return;
    setPosting(true);
    setPostResult(null);
    setPostError(null);
    setUndone(false);
    try {
      const rows = parsedRows.map((r) => ({
        date: `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(r.day).padStart(2, "0")}`,
        costCentre: r.costCentre || undefined,
        subCost: r.subCost || undefined,
        code: r.code || undefined,
        keterangan: r.keterangan,
        dbcr: r.dbcr,
        amount: r.amount,
        contraAccountId: resolvedContraFor(r),
      }));
      // Only the explicit per-Keterangan overrides (the "mapping" state,
      // set via the Pengecualian panel) get remembered for next time —
      // NOT every row's resolved default, which would otherwise try to
      // save a mapping per one-off description (see postJournalImportBatch).
      const learnedMappings = Object.entries(mapping)
        .filter(([, accountId]) => accountId)
        .map(([key, accountId]) => {
          const original = keteranganStats.find((k) => k.key === key)?.original ?? key;
          return { keterangan: original, contraAccountId: accountId };
        });
      const res = await fetch("/api/finance/journal-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cashBook, fileName, targetYear: Number(targetYear), targetMonth: Number(targetMonth), rows, learnedMappings }),
      });
      const data = await res.json();
      if (res.ok) {
        setPostResult(
          `${data.created} jurnal berhasil diposting ke ${CASH_BOOK_LABELS[cashBook]} — ${BULAN_NAMES_ID[Number(targetMonth) - 1][0].toUpperCase() + BULAN_NAMES_ID[Number(targetMonth) - 1].slice(1)} ${targetYear}. Setiap jurnal sudah seimbang sendiri (1 baris debit = 1 baris kredit). Total baris bertanda DB di file: ${currency.format(data.totalDebitRows)}, total baris bertanda CR: ${currency.format(data.totalCreditRows)} (dua angka ini wajar berbeda — itu kas masuk vs kas keluar, bukan indikator ketidakseimbangan).`,
        );
        setLastBatchId(data.batchId);
        setParsedRows(null);
        setFileName(null);
        setConfirming(false);
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

  async function undoLastImport() {
    if (!lastBatchId) return;
    setUndoing(true);
    try {
      const res = await fetch(`/api/finance/journal-import/${lastBatchId}`, { method: "DELETE" });
      if (res.ok) {
        setUndone(true);
        setLastBatchId(null);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setPostError(typeof data.error === "string" ? data.error : "Gagal membatalkan import.");
      }
    } catch {
      setPostError("Gagal membatalkan import.");
    } finally {
      setUndoing(false);
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
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-600">
            <AlertTriangle className="h-3.5 w-3.5" /> Gagal membaca file
          </p>
          <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] text-rose-700">{parseError}</pre>
        </div>
      )}

      {parsedRows && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-slate-700">
              Pratinjau — {fileName} ({parsedRows.length} baris, {keteranganStats.length} jenis Keterangan)
            </p>
            {unresolvedCount > 0 ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">{unresolvedCount} baris belum ada akun lawan</span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                <Check className="h-3 w-3" /> Semua baris sudah ada akun lawan
              </span>
            )}
          </div>

          {/* Default accounts — the only thing required for most files.
              Per-Keterangan overrides below are optional. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {hasDbRows && (
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-500">Akun Lawan untuk semua baris DB (kas masuk)</label>
                <select
                  value={defaultDbAccountId}
                  onChange={(e) => setDefaultDbAccountId(e.target.value)}
                  className={`w-full rounded-md border px-2 py-1.5 text-xs ${!defaultDbAccountId ? "border-amber-400 bg-amber-50" : "border-slate-300 bg-white"}`}
                >
                  <option value="">— pilih akun —</option>
                  {contraOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      [{a.code}] {a.name}
                      {a.cashBook ? ` (${CASH_BOOK_LABELS[a.cashBook]} — jadi Transfer Antar Buku)` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {hasCrRows && (
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-500">Akun Lawan untuk semua baris CR (kas keluar)</label>
                <select
                  value={defaultCrAccountId}
                  onChange={(e) => setDefaultCrAccountId(e.target.value)}
                  className={`w-full rounded-md border px-2 py-1.5 text-xs ${!defaultCrAccountId ? "border-amber-400 bg-amber-50" : "border-slate-300 bg-white"}`}
                >
                  <option value="">— pilih akun —</option>
                  {contraOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      [{a.code}] {a.name}
                      {a.cashBook ? ` (${CASH_BOOK_LABELS[a.cashBook]} — jadi Transfer Antar Buku)` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <p className="text-[11px] text-slate-400">
            Dipakai untuk baris yang Keterangan-nya tidak diatur khusus di bawah. Kalau mau akun berbeda untuk Keterangan tertentu (mis. &quot;Admin
            Bank&quot;), atur lewat &quot;Pengecualian per Keterangan&quot; di bawah — tidak wajib diisi semua.
          </p>

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

          <div>
            <button onClick={() => setShowOverrides((v) => !v)} className="text-xs font-semibold text-accent-700 hover:text-accent-800">
              {showOverrides ? "▾" : "▸"} Pengecualian per Keterangan (opsional{repeatingKeterangan.length > 0 ? ` — ${repeatingKeterangan.length} Keterangan muncul berulang` : ""})
            </button>
            {showOverrides && (
              <div className="mt-2 max-h-[40vh] overflow-auto rounded-lg border border-slate-200 bg-white">
                {repeatingKeterangan.length === 0 ? (
                  <p className="p-3 text-xs text-slate-400">Tidak ada Keterangan yang muncul berulang di file ini — semua baris akan pakai akun default di atas.</p>
                ) : (
                  <table className="w-full min-w-[800px] border-collapse text-xs">
                    <thead className="sticky top-0 bg-brand-950 text-white">
                      <tr>
                        <th className="px-2 py-1.5 text-left">Keterangan</th>
                        <th className="px-2 py-1.5 text-right">Jumlah Baris</th>
                        <th className="px-2 py-1.5 text-left">Akun Lawan Khusus</th>
                      </tr>
                    </thead>
                    <tbody>
                      {repeatingKeterangan.map(({ key, original, count }) => (
                        <tr key={key} className="border-b border-slate-100">
                          <td className="px-2 py-1.5">{original}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{count}</td>
                          <td className="px-1 py-1">
                            <select
                              value={mapping[key] ?? ""}
                              onChange={(e) => setMapping((prev) => ({ ...prev, [key]: e.target.value }))}
                              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
                            >
                              <option value="">(pakai akun default)</option>
                              {contraOptions.map((a) => (
                                <option key={a.id} value={a.id}>
                                  [{a.code}] {a.name}
                                  {a.cashBook ? ` (${CASH_BOOK_LABELS[a.cashBook]} — jadi Transfer Antar Buku)` : ""}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>

          {!confirming ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setConfirming(true)}
                disabled={posting || unresolvedCount > 0}
                className="flex items-center gap-1.5 rounded-lg bg-brand-900 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Upload className="h-3.5 w-3.5" /> Posting {parsedRows.length} Jurnal
              </button>
              {unresolvedCount > 0 && <p className="text-xs text-slate-500">Petakan dulu semua Keterangan di atas sebelum bisa posting.</p>}
            </div>
          ) : (
            <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-4">
              <p className="flex items-center gap-1.5 text-sm font-bold text-amber-900">
                <AlertTriangle className="h-4 w-4" /> Periksa dulu sebelum posting — ini tidak bisa diedit per baris setelah tersimpan
              </p>
              <ul className="mt-2 space-y-0.5 text-xs text-amber-800">
                <li>
                  • Buku Kas: <strong>{CASH_BOOK_LABELS[cashBook]}</strong>
                </li>
                <li>
                  • Periode tujuan: <strong>{BULAN_NAMES_ID[Number(targetMonth) - 1][0].toUpperCase() + BULAN_NAMES_ID[Number(targetMonth) - 1].slice(1)} {targetYear}</strong>
                </li>
                <li>
                  • Jumlah baris: <strong>{parsedRows.length}</strong> ({currency.format(totalDb)} DB / {currency.format(totalCr)} CR)
                </li>
                {hasDbRows && (
                  <li>
                    • Akun Lawan default (DB): <strong>{contraOptions.find((a) => a.id === defaultDbAccountId)?.name ?? "-"}</strong>
                  </li>
                )}
                {hasCrRows && (
                  <li>
                    • Akun Lawan default (CR): <strong>{contraOptions.find((a) => a.id === defaultCrAccountId)?.name ?? "-"}</strong>
                  </li>
                )}
              </ul>
              <p className="mt-2 text-xs text-amber-700">
                Sudah benar Buku Kas dan periodenya? Kalau salah, pilih ulang di atas sebelum lanjut — mengimpor ke periode/buku yang salah tetap bisa
                dibatalkan sesudahnya lewat tombol &quot;Batalkan Import Ini&quot;, tapi lebih aman dicek dulu sekarang.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={postImport}
                  disabled={posting}
                  className="flex items-center gap-1.5 rounded-lg bg-brand-900 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" /> {posting ? "Memposting..." : "Ya, Sudah Benar — Posting Sekarang"}
                </button>
                <button onClick={() => setConfirming(false)} disabled={posting} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                  Batal, Cek Lagi
                </button>
              </div>
            </div>
          )}
          {postError && <p className="text-xs font-semibold text-rose-600">{postError}</p>}
        </div>
      )}
      {postResult && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
            <Check className="h-4 w-4" /> {postResult}
          </p>
          {lastBatchId && (
            <button
              onClick={undoLastImport}
              disabled={undoing}
              className="shrink-0 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
            >
              {undoing ? "Membatalkan..." : "Batalkan Import Ini"}
            </button>
          )}
        </div>
      )}
      {undone && (
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-600">
          <Check className="h-4 w-4" /> Import tadi sudah dibatalkan — semua jurnal dari batch itu sudah dihapus.
        </p>
      )}
    </div>
  );
}
