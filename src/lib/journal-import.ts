import "server-only";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { CashBook } from "@prisma/client";

export function normalizeKeterangan(s: string): string {
  return s.trim().toLowerCase();
}

// Every Buku Kas's own "Transitory" (suspense/clearing) account — already
// present in this business's own Chart of Account, built for exactly this:
// park an import whose real GL classification isn't known yet, to be
// reclassified later via Jurnal Penyesuaian. Used automatically as the
// akun lawan for every row of that book's import — no picker, no setting,
// nothing asked during upload (per explicit request 2026-10-13: "akun
// lawan di hilangkan DALAM PROSES MENGUPLOAD", then "hilangkan akun
// lawan... hanya cukup button upload saja", confirmed against this exact
// code mapping).
const TRANSITORY_ACCOUNT_CODE: Record<CashBook, string> = {
  KASIR: "81100",
  BRANKAS: "81200",
  OUTLET: "81400",
  PETTY_CASH: "81300",
  BANK_BCA: "81600",
  BANK_MANDIRI: "81700",
};

export type JournalImportRowInput = {
  date: string;
  costCentre?: string;
  subCost?: string;
  code?: string;
  keterangan: string;
  dbcr: "DB" | "CR";
  amount: number;
};

// Posts a batch of already-parsed rows (see JournalImportForm for the
// Excel-parsing step that produces these) as real JournalEntry + 2 lines
// each — a DB row debits the uploaded book's own account and credits its
// Transitory account, a CR row the reverse.
export async function postJournalImportBatch(params: {
  cashBook: CashBook;
  rows: JournalImportRowInput[];
  createdById: string;
  fileName?: string;
  targetYear: number;
  targetMonth: number;
}) {
  const { cashBook, rows, createdById, fileName, targetYear, targetMonth } = params;

  // Created FIRST (totals filled in after the loop, via update) so every
  // entry below can be tagged with its batch id as it's created — see
  // JournalImportBatch: this is what lets a whole mis-targeted upload
  // (wrong period, wrong buku kas) be undone in one action instead of
  // voiding each entry by hand.
  const batch = await prisma.journalImportBatch.create({
    data: { cashBook, fileName, targetYear, targetMonth, rowCount: rows.length, totalDebitRows: 0, totalCreditRows: 0, createdById },
  });

  const [uploadedBookAccount, transitoryAccount, allExisting] = await Promise.all([
    prisma.chartOfAccount.findFirst({ where: { cashBook, status: "ACTIVE" } }),
    prisma.chartOfAccount.findFirst({ where: { code: TRANSITORY_ACCOUNT_CODE[cashBook] } }),
    prisma.journalEntry.findMany({ select: { entryNumber: true } }),
  ]);
  if (!uploadedBookAccount) throw new Error(`Tidak ada akun aktif untuk buku kas ${cashBook}`);
  if (!transitoryAccount) {
    throw new Error(`Akun Transitory (kode ${TRANSITORY_ACCOUNT_CODE[cashBook]}) untuk buku kas ini tidak ditemukan di Chart of Account.`);
  }

  const existingSet = new Set(allExisting.map((r) => r.entryNumber));
  let entryCounter = 0;
  function nextEntryNumber(): string {
    const year = new Date().getFullYear();
    if (entryCounter === 0) {
      for (const num of existingSet) {
        const m = num.match(new RegExp(`^${cashBook}-${year}-(\\d{6})$`));
        if (m) entryCounter = Math.max(entryCounter, Number(m[1]));
      }
    }
    let n = entryCounter + 1;
    let candidate = `${cashBook}-${year}-${String(n).padStart(6, "0")}`;
    while (existingSet.has(candidate)) {
      n += 1;
      candidate = `${cashBook}-${year}-${String(n).padStart(6, "0")}`;
    }
    entryCounter = n;
    existingSet.add(candidate);
    return candidate;
  }

  // Sums of the rows AS MARKED in the source file (DB vs CR) — purely
  // informational, for the caller to cross-check against the file's own
  // stated totals. True double-entry balance is guaranteed by construction
  // below (every entry gets exactly one debit line and one credit line of
  // the same amount), not something to check here.
  let totalDebitRows = 0;
  let totalCreditRows = 0;

  // Build every entry + its 2 lines in memory first, THEN write with two
  // createMany calls (not one create() per row) — a real 500-row import
  // took minutes with the one-row-at-a-time version (confirmed 2026-10-13);
  // this brings it to seconds regardless of file size. IDs are generated
  // here (not left to the DB) specifically so the matching line rows can
  // reference their entry before either is actually written.
  const entryRows: {
    id: string;
    entryNumber: string;
    date: Date;
    cashBook: CashBook;
    entryType: "KAS_MASUK" | "KAS_KELUAR";
    description: string;
    status: "POSTED";
    createdById: string;
    importBatchId: string;
  }[] = [];
  const lineRows: {
    id: string;
    journalEntryId: string;
    accountId: string;
    debit: number;
    credit: number;
    remark: string;
    costCentre: string | null;
    costDescription: string | null;
    isDebitSide: boolean;
  }[] = [];

  for (const row of rows) {
    const rowDate = new Date(`${row.date}T00:00:00.000Z`);
    const isDebit = row.dbcr === "DB";
    const entryId = crypto.randomUUID();
    entryRows.push({
      id: entryId,
      entryNumber: nextEntryNumber(),
      date: rowDate,
      cashBook,
      entryType: isDebit ? "KAS_MASUK" : "KAS_KELUAR",
      description: row.keterangan,
      status: "POSTED",
      createdById,
      importBatchId: batch.id,
    });
    const costDescription = [row.subCost, row.code].filter(Boolean).join(" ") || null;
    lineRows.push(
      {
        id: crypto.randomUUID(),
        journalEntryId: entryId,
        accountId: uploadedBookAccount.id,
        debit: isDebit ? row.amount : 0,
        credit: isDebit ? 0 : row.amount,
        remark: row.keterangan,
        costCentre: row.costCentre || null,
        costDescription,
        isDebitSide: isDebit,
      },
      {
        id: crypto.randomUUID(),
        journalEntryId: entryId,
        accountId: transitoryAccount.id,
        debit: isDebit ? 0 : row.amount,
        credit: isDebit ? row.amount : 0,
        remark: row.keterangan,
        costCentre: row.costCentre || null,
        costDescription,
        isDebitSide: !isDebit,
      },
    );
    if (isDebit) totalDebitRows += row.amount;
    else totalCreditRows += row.amount;
  }

  const BATCH_SIZE = 1000;
  for (let i = 0; i < entryRows.length; i += BATCH_SIZE) {
    await prisma.journalEntry.createMany({ data: entryRows.slice(i, i + BATCH_SIZE) });
  }
  for (let i = 0; i < lineRows.length; i += BATCH_SIZE) {
    await prisma.journalEntryLine.createMany({ data: lineRows.slice(i, i + BATCH_SIZE) });
  }
  const created = entryRows.length;

  await prisma.journalImportBatch.update({
    where: { id: batch.id },
    data: { totalDebitRows, totalCreditRows },
  });

  return { created, totalDebitRows, totalCreditRows, batchId: batch.id };
}

// Deletes an entire import batch — every entry + line it created, then
// the batch row itself. The "undo" for a mis-targeted upload (wrong
// period or wrong buku kas picked before posting).
export async function deleteJournalImportBatch(batchId: string): Promise<number> {
  const entries = await prisma.journalEntry.findMany({ where: { importBatchId: batchId }, select: { id: true } });
  const ids = entries.map((e) => e.id);
  await prisma.journalEntryLine.deleteMany({ where: { journalEntryId: { in: ids } } });
  await prisma.journalEntry.deleteMany({ where: { id: { in: ids } } });
  await prisma.journalImportBatch.delete({ where: { id: batchId } });
  return ids.length;
}
