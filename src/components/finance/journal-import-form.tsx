"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

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

// Normalizes any of the reasonable ways a file might mark a debit/credit
// row ("D/K", "Debit/Kredit", ...), not just the literal "DB"/"CR".
// Returns null for anything unrecognized rather than guessing.
function normalizeDbCr(raw: string): "DB" | "CR" | null {
  const t = raw.trim().toUpperCase();
  if (t === "DB" || t === "D" || t === "DEBIT") return "DB";
  if (t === "CR" || t === "K" || t === "C" || t === "KREDIT" || t === "CREDIT") return "CR";
  return null;
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

// Minimal flow (simplified 2026-10-13, then simplified further the same
// day per explicit, repeated request: "akun lawan di hilangkan DALAM
// PROSES MENGUPLOAD", then "hilangkan allert dan akun lawan, hanya cukup
// button upload saja"): set Buku Kas/Tahun/Bulan, pick the file, press
// Upload — it parses and posts immediately, no confirm() dialog and no
// account picker anywhere in this component at all. The akun lawan is
// resolved entirely server-side (see postJournalImportBatch) from each
// Buku Kas's own pre-existing "Transitory" suspense account in the Chart
// of Account — confirmed against that exact account mapping. "Batalkan
// Import Ini" / Riwayat Import below stay as the only safety net for a
// wrong period/buku kas.
export function JournalImportForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cashBook, setCashBook] = useState<string>("BRANKAS");
  const [targetYear, setTargetYear] = useState(String(new Date().getFullYear()));
  const [targetMonth, setTargetMonth] = useState(String(new Date().getMonth() + 1));
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [parseError, setParseError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [postProgress, setPostProgress] = useState<string | null>(null);
  const [postResult, setPostResult] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const [lastBatchId, setLastBatchId] = useState<string | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [undone, setUndone] = useState(false);

  async function handleUpload() {
    const file = selectedFile;
    if (!file) return;
    setParseError(null);
    setPostResult(null);
    setPostError(null);
    setUndone(false);

    let rows: ParsedRow[];
    try {
      rows = await parseFile(file);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Gagal membaca file.");
      return;
    }

    await postImport(rows, file.name);
  }

  // A real file can have far more rows than safely fit in one request —
  // Vercel caps a Serverless Function's request body around 4.5MB, which
  // a plain row-count limit can't prevent (a real Outlet statement hit
  // this 2026-10-13). So a large file is split into chunks and posted
  // sequentially, all into the SAME JournalImportBatch (see
  // postJournalImportBatch's `existingBatchId`) — "Batalkan Import Ini"
  // still undoes the whole file in one action no matter how many
  // requests it took to post it.
  const CHUNK_SIZE = 1500;

  async function postImport(rows: ParsedRow[], fileName: string) {
    setPosting(true);
    setPostResult(null);
    setPostError(null);
    try {
      const chunks: ParsedRow[][] = [];
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) chunks.push(rows.slice(i, i + CHUNK_SIZE));

      let batchId: string | undefined;
      let totalDebitRows = 0;
      let totalCreditRows = 0;
      let createdTotal = 0;

      for (let i = 0; i < chunks.length; i++) {
        if (chunks.length > 1) {
          setPostProgress(`Memposting... (${Math.min((i + 1) * CHUNK_SIZE, rows.length)} dari ${rows.length} baris)`);
        }
        const payloadRows = chunks[i].map((r) => ({
          date: `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(r.day).padStart(2, "0")}`,
          costCentre: r.costCentre || undefined,
          subCost: r.subCost || undefined,
          code: r.code || undefined,
          keterangan: r.keterangan,
          dbcr: r.dbcr,
          amount: r.amount,
        }));
        const res = await fetch("/api/finance/journal-import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cashBook,
            fileName,
            targetYear: Number(targetYear),
            targetMonth: Number(targetMonth),
            rows: payloadRows,
            existingBatchId: batchId,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          const already = batchId ? ` ${createdTotal} dari ${rows.length} baris sudah terlanjur terposting — pakai "Batalkan Import Ini" di bawah kalau mau mengulang dari awal.` : "";
          setPostError((typeof data.error === "string" ? data.error : JSON.stringify(data.error)) + already);
          if (batchId) setLastBatchId(batchId);
          return;
        }
        batchId = data.batchId;
        totalDebitRows = data.totalDebitRows;
        totalCreditRows = data.totalCreditRows;
        createdTotal += data.created;
      }

      setPostResult(
        `${createdTotal} jurnal berhasil diposting ke ${CASH_BOOK_LABELS[cashBook]} — ${BULAN_NAMES_ID[Number(targetMonth) - 1][0].toUpperCase() + BULAN_NAMES_ID[Number(targetMonth) - 1].slice(1)} ${targetYear}. Total baris bertanda DB: ${currency.format(totalDebitRows)}, total baris bertanda CR: ${currency.format(totalCreditRows)}.`,
      );
      setLastBatchId(batchId ?? null);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } catch {
      setPostError("Gagal mengirim data ke server.");
    } finally {
      setPosting(false);
      setPostProgress(null);
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
            disabled={posting}
            onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs disabled:opacity-50"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleUpload}
          disabled={!selectedFile || posting}
          className="rounded-lg bg-accent-600 px-4 py-2 text-xs font-semibold text-white hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {posting ? "Memposting..." : "Upload"}
        </button>
      </div>

      <p className="text-[11px] text-slate-400">
        Pilih Buku Kas dan periode tujuan, pilih file, lalu tekan Upload — jurnalnya langsung terposting, berapa pun jumlah barisnya (file besar otomatis
        dipecah jadi beberapa bagian saat dikirim). Akun lawan diambil otomatis dari akun Transitory Buku Kas yang bersangkutan. Tanggal pada file hanya
        dipakai tanggal-nya (hari); bulan &amp; tahun selalu memakai pilihan di atas.
      </p>

      {posting && <p className="text-xs font-semibold text-accent-700">{postProgress ?? "Memposting..."}</p>}
      {parseError && <p className="text-xs font-semibold text-rose-600 whitespace-pre-wrap">{parseError}</p>}
      {postError && <p className="text-xs font-semibold text-rose-600">{postError}</p>}

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
