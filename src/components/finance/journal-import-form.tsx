"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

type Account = { id: string; code: string; name: string; cashBook: string | null };
type ImportDefault = { defaultDbAccountId: string | null; defaultCrAccountId: string | null };

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

// Minimal flow (simplified 2026-10-13 — the earlier preview/per-Keterangan
// -mapping screen was "sangat merepotkan" for a real bank statement with
// 1875 near-unique descriptions): set Buku Kas/Tahun/Bulan, pick the
// file, press Upload, get one confirm() summarizing what's about to be
// posted, and on OK it posts immediately — no in-page preview table.
// "Batalkan Import Ini" / Riwayat Import below stay as the safety net
// for a wrong period/buku kas, same as before.
//
// Akun lawan (DB/CR) (further simplified same day, per explicit request:
// "akun lawan di hilangkan DALAM PROSES MENGUPLOAD" / "cukup mengupload
// saja, diberikan button upload"): the contra-account pickers are now
// fully OUT of the upload path. Each Buku Kas's akun lawan is configured
// once via the separate, collapsed "Atur Akun Lawan Default" panel
// (saved straight to JournalImportDefaultAccount, independent of any
// import), and the upload row itself is just Buku Kas / Tahun / Bulan /
// File / tombol Upload — pressing Upload silently reuses whatever's
// already configured, no account UI in that path at all. If a book was
// never configured yet, Upload is blocked with an error pointing at the
// settings panel instead of showing the pickers inline.
export function JournalImportForm({ accounts, importDefaults }: { accounts: Account[]; importDefaults: Record<string, ImportDefault> }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cashBook, setCashBook] = useState<string>("BRANKAS");
  const [targetYear, setTargetYear] = useState(String(new Date().getFullYear()));
  const [targetMonth, setTargetMonth] = useState(String(new Date().getMonth() + 1));
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // What's actually configured per Buku Kas — seeded from the server,
  // then kept in sync locally whenever the settings panel saves a change
  // (so Upload sees it immediately, without a full page reload).
  const [defaultsByBook, setDefaultsByBook] = useState<Record<string, ImportDefault>>(importDefaults);
  const currentDefault = defaultsByBook[cashBook];
  const defaultDbAccountId = currentDefault?.defaultDbAccountId ?? "";
  const defaultCrAccountId = currentDefault?.defaultCrAccountId ?? "";

  // The settings panel's own edit buffer — only touched while the panel
  // is open, separate from `defaultsByBook` so typing in it doesn't
  // affect Upload until "Simpan" is pressed.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editDbAccountId, setEditDbAccountId] = useState("");
  const [editCrAccountId, setEditCrAccountId] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const [parseError, setParseError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [postResult, setPostResult] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const [lastBatchId, setLastBatchId] = useState<string | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [undone, setUndone] = useState(false);

  function handleCashBookChange(next: string) {
    setCashBook(next);
    const nextDefault = defaultsByBook[next];
    setEditDbAccountId(nextDefault?.defaultDbAccountId ?? "");
    setEditCrAccountId(nextDefault?.defaultCrAccountId ?? "");
    setSettingsSaved(false);
  }

  function openSettings() {
    setEditDbAccountId(defaultDbAccountId);
    setEditCrAccountId(defaultCrAccountId);
    setSettingsSaved(false);
    setSettingsOpen(true);
  }

  async function saveSettings() {
    setSavingSettings(true);
    setSettingsSaved(false);
    try {
      const res = await fetch("/api/finance/journal-import/default-account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cashBook, defaultDbAccountId: editDbAccountId || null, defaultCrAccountId: editCrAccountId || null }),
      });
      const data = await res.json();
      if (res.ok) {
        setDefaultsByBook((prev) => ({ ...prev, [cashBook]: { defaultDbAccountId: data.defaultDbAccountId, defaultCrAccountId: data.defaultCrAccountId } }));
        setSettingsSaved(true);
        setParseError(null);
      } else {
        setPostError(typeof data.error === "string" ? data.error : "Gagal menyimpan akun lawan.");
      }
    } catch {
      setPostError("Gagal menyimpan akun lawan.");
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleUpload() {
    const file = selectedFile;
    if (!file) return;
    setParseError(null);
    setPostResult(null);
    setPostError(null);
    setUndone(false);

    if (!defaultDbAccountId && !defaultCrAccountId) {
      setParseError(`Akun lawan untuk ${CASH_BOOK_LABELS[cashBook]} belum diatur — buka "Atur Akun Lawan Default" di bawah, lalu ulangi Upload.`);
      return;
    }

    let rows: ParsedRow[];
    try {
      rows = await parseFile(file);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Gagal membaca file.");
      return;
    }

    const hasDbRows = rows.some((r) => r.dbcr === "DB");
    const hasCrRows = rows.some((r) => r.dbcr === "CR");
    if ((hasDbRows && !defaultDbAccountId) || (hasCrRows && !defaultCrAccountId)) {
      setParseError(
        `File ini punya baris ${hasDbRows && !defaultDbAccountId ? "DB" : "CR"} tapi akun lawan untuk itu belum diatur untuk ${CASH_BOOK_LABELS[cashBook]} — buka "Atur Akun Lawan Default" di bawah, lalu ulangi Upload.`,
      );
      return;
    }

    const totalDb = rows.filter((r) => r.dbcr === "DB").reduce((s, r) => s + r.amount, 0);
    const totalCr = rows.filter((r) => r.dbcr === "CR").reduce((s, r) => s + r.amount, 0);
    const bulanLabel = BULAN_NAMES_ID[Number(targetMonth) - 1][0].toUpperCase() + BULAN_NAMES_ID[Number(targetMonth) - 1].slice(1);
    const dbAccountName = accounts.find((a) => a.id === defaultDbAccountId)?.name ?? "-";
    const crAccountName = accounts.find((a) => a.id === defaultCrAccountId)?.name ?? "-";

    const summary = [
      `Import ${rows.length} jurnal dari "${file.name}"?`,
      "",
      `Buku Kas: ${CASH_BOOK_LABELS[cashBook]}`,
      `Periode tujuan: ${bulanLabel} ${targetYear}`,
      hasDbRows ? `Total DB: ${currency.format(totalDb)} -> akun lawan "${dbAccountName}"` : null,
      hasCrRows ? `Total CR: ${currency.format(totalCr)} -> akun lawan "${crAccountName}"` : null,
      "",
      "Pastikan Buku Kas dan periode di atas sudah benar sebelum menekan OK — bisa dibatalkan sesudahnya lewat \"Batalkan Import Ini\" kalau ternyata salah.",
    ]
      .filter((l) => l !== null)
      .join("\n");

    if (!window.confirm(summary)) return;

    await postImport(rows, file.name);
  }

  async function postImport(rows: ParsedRow[], fileName: string) {
    setPosting(true);
    setPostResult(null);
    setPostError(null);
    try {
      const payloadRows = rows.map((r) => ({
        date: `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(r.day).padStart(2, "0")}`,
        costCentre: r.costCentre || undefined,
        subCost: r.subCost || undefined,
        code: r.code || undefined,
        keterangan: r.keterangan,
        dbcr: r.dbcr,
        amount: r.amount,
        contraAccountId: r.dbcr === "DB" ? defaultDbAccountId : defaultCrAccountId,
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
          defaultDbAccountId: defaultDbAccountId || undefined,
          defaultCrAccountId: defaultCrAccountId || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setPostResult(
          `${data.created} jurnal berhasil diposting ke ${CASH_BOOK_LABELS[cashBook]} — ${BULAN_NAMES_ID[Number(targetMonth) - 1][0].toUpperCase() + BULAN_NAMES_ID[Number(targetMonth) - 1].slice(1)} ${targetYear}. Total baris bertanda DB: ${currency.format(data.totalDebitRows)}, total baris bertanda CR: ${currency.format(data.totalCreditRows)}.`,
        );
        setLastBatchId(data.batchId);
        setSelectedFile(null);
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
          <select value={cashBook} onChange={(e) => handleCashBookChange(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs">
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
        <button type="button" onClick={openSettings} className="text-[11px] font-semibold text-slate-400 hover:text-accent-700">
          Atur Akun Lawan Default
        </button>
      </div>

      {settingsOpen && (
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="col-span-2 text-[11px] font-semibold text-slate-500">Akun lawan default untuk {CASH_BOOK_LABELS[cashBook]}</p>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-500">Akun Lawan untuk baris DB</label>
            <select
              value={editDbAccountId}
              onChange={(e) => setEditDbAccountId(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
            >
              <option value="">— pilih akun —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  [{a.code}] {a.name}
                  {a.cashBook ? ` (${CASH_BOOK_LABELS[a.cashBook]} — jadi Transfer Antar Buku)` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-500">Akun Lawan untuk baris CR</label>
            <select
              value={editCrAccountId}
              onChange={(e) => setEditCrAccountId(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
            >
              <option value="">— pilih akun —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  [{a.code}] {a.name}
                  {a.cashBook ? ` (${CASH_BOOK_LABELS[a.cashBook]} — jadi Transfer Antar Buku)` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2 flex items-center gap-3">
            <button
              type="button"
              onClick={saveSettings}
              disabled={savingSettings}
              className="rounded-lg border border-accent-300 bg-white px-3 py-1.5 text-xs font-semibold text-accent-700 hover:bg-accent-50 disabled:opacity-50"
            >
              {savingSettings ? "Menyimpan..." : "Simpan"}
            </button>
            <button type="button" onClick={() => setSettingsOpen(false)} className="text-xs font-semibold text-slate-400 hover:text-slate-600">
              Tutup
            </button>
            {settingsSaved && <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700"><Check className="h-3.5 w-3.5" /> Tersimpan</span>}
          </div>
          <p className="col-span-2 text-[11px] text-slate-400">
            Diatur sekali per Buku Kas — dipakai otomatis setiap kali Upload untuk {CASH_BOOK_LABELS[cashBook]}, tidak ditanyakan lagi di proses upload.
          </p>
        </div>
      )}

      <p className="text-[11px] text-slate-400">
        Pilih Buku Kas dan periode tujuan, pilih file, lalu tekan Upload — langsung muncul konfirmasi ringkas (jumlah baris, total DB/CR) dan setelah
        di-OK jurnalnya otomatis terposting. Tanggal pada file hanya dipakai tanggal-nya (hari); bulan &amp; tahun selalu memakai pilihan di atas.
      </p>

      {posting && <p className="text-xs font-semibold text-accent-700">Memposting...</p>}
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
