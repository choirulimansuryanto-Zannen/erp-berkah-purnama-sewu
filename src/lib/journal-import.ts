import "server-only";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { CashBook } from "@prisma/client";

export function normalizeKeterangan(s: string): string {
  return s.trim().toLowerCase();
}

export type JournalImportRowInput = {
  date: string;
  costCentre?: string;
  subCost?: string;
  code?: string;
  keterangan: string;
  dbcr: "DB" | "CR";
  amount: number;
  contraAccountId: string;
};

// Posts a batch of already-classified rows (see JournalImportForm for the
// Excel-parsing + account-mapping-resolution step that produces these) as
// real JournalEntry + 2 lines each, and remembers each row's Keterangan ->
// contraAccountId choice in JournalImportMapping so a later upload with
// the same recurring descriptions (e.g. "Transfer Petty Cash") resolves
// automatically without asking again.
//
// cashBook/dbcr -> entryType, same convention postCashVoucher uses
// (KAS_MASUK debits the uploaded book; KAS_KELUAR credits it) — EXCEPT
// when the resolved contra account is ITSELF a cash-book account: that
// makes this genuinely a Transfer Antar Buku, and per that type's own
// rule (see lib/accounting.ts's postCashVoucher) the tagged cashBook must
// be the SOURCE (credited/decreased) side, not whichever book the file
// was uploaded for. A "DB" row against a cash-book contra means the
// uploaded book is the one increasing — i.e. the DESTINATION — so that
// entry gets tagged under the CONTRA's book instead, with the uploaded
// book's own account as contra. This is exactly what made "Buku Brankas"
// correctly show incoming transfers after the Jurnal page's own
// touchedCashBooks fix (2026-10-12).
export async function postJournalImportBatch(params: {
  cashBook: CashBook;
  rows: JournalImportRowInput[];
  createdById: string;
  fileName?: string;
  targetYear: number;
  targetMonth: number;
  // Only the EXPLICIT per-Keterangan overrides the user actually picked
  // (the "Pengecualian per Keterangan" panel) — NOT every row's resolved
  // contraAccountId. A bank-statement file routinely has 1000+ distinct,
  // never-repeated descriptions that all resolve through the DB/CR
  // defaults; saving each of those as its own "remembered mapping" would
  // be useless (a one-off description is never looked up again) and,
  // worse, would mean upserting thousands of rows here on every import —
  // confirmed 2026-10-13 this made a 500-row import take minutes.
  learnedMappings?: { keterangan: string; contraAccountId: string }[];
}) {
  const { cashBook, rows, createdById, fileName, targetYear, targetMonth, learnedMappings = [] } = params;

  // Created FIRST (totals filled in after the loop, via update) so every
  // entry below can be tagged with its batch id as it's created — see
  // JournalImportBatch: this is what lets a whole mis-targeted upload
  // (wrong period, wrong buku kas) be undone in one action instead of
  // voiding each entry by hand.
  const batch = await prisma.journalImportBatch.create({
    data: { cashBook, fileName, targetYear, targetMonth, rowCount: rows.length, totalDebitRows: 0, totalCreditRows: 0, createdById },
  });

  const [uploadedBookAccount, allCashBookAccounts, allExisting] = await Promise.all([
    prisma.chartOfAccount.findFirst({ where: { cashBook, status: "ACTIVE" } }),
    prisma.chartOfAccount.findMany({ where: { cashBook: { not: null } }, select: { id: true, cashBook: true } }),
    prisma.journalEntry.findMany({ select: { entryNumber: true } }),
  ]);
  if (!uploadedBookAccount) throw new Error(`Tidak ada akun aktif untuk buku kas ${cashBook}`);
  const cashBookByAccountId = new Map(allCashBookAccounts.map((a) => [a.id, a.cashBook]));

  const existingSet = new Set(allExisting.map((r) => r.entryNumber));
  const counters = new Map<string, number>();
  function nextEntryNumber(prefix: string): string {
    const year = new Date().getFullYear();
    if (!counters.has(prefix)) {
      let max = 0;
      for (const num of existingSet) {
        const m = num.match(new RegExp(`^${prefix}-${year}-(\\d{6})$`));
        if (m) max = Math.max(max, Number(m[1]));
      }
      counters.set(prefix, max);
    }
    let n = (counters.get(prefix) ?? 0) + 1;
    let candidate = `${prefix}-${year}-${String(n).padStart(6, "0")}`;
    while (existingSet.has(candidate)) {
      n += 1;
      candidate = `${prefix}-${year}-${String(n).padStart(6, "0")}`;
    }
    counters.set(prefix, n);
    existingSet.add(candidate);
    return candidate;
  }

  // Sums of the rows AS MARKED in the source file (DB vs CR from the
  // uploaded book's own perspective) — purely informational, for the
  // caller to cross-check against the file's own stated totals. These
  // are NOT expected to be equal to each other (a DB row and a CR row
  // aren't opposite legs of the same transaction, they're independent
  // cash-in/cash-out events) — true double-entry balance is guaranteed
  // by construction below (every entry gets exactly one debit line and
  // one credit line of the same amount), not something to check here.
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
    entryType: "KAS_MASUK" | "KAS_KELUAR" | "TRANSFER_ANTAR_BUKU";
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
    const contraCashBook = cashBookByAccountId.get(row.contraAccountId) ?? null;
    const uploadedIsDebit = row.dbcr === "DB";

    let entryType: "KAS_MASUK" | "KAS_KELUAR" | "TRANSFER_ANTAR_BUKU";
    let taggedCashBook: CashBook;
    let taggedAccountId: string;
    let taggedIsDebit: boolean;

    if (contraCashBook) {
      entryType = "TRANSFER_ANTAR_BUKU";
      if (uploadedIsDebit) {
        // Uploaded book is increasing -> it's the destination -> the
        // CONTRA's book is the true source, tag the entry there instead.
        taggedCashBook = contraCashBook;
        taggedAccountId = row.contraAccountId;
        taggedIsDebit = false; // source is always credited
      } else {
        taggedCashBook = cashBook;
        taggedAccountId = uploadedBookAccount.id;
        taggedIsDebit = false;
      }
    } else {
      entryType = uploadedIsDebit ? "KAS_MASUK" : "KAS_KELUAR";
      taggedCashBook = cashBook;
      taggedAccountId = uploadedBookAccount.id;
      taggedIsDebit = uploadedIsDebit;
    }
    const otherAccountId = taggedAccountId === uploadedBookAccount.id ? row.contraAccountId : uploadedBookAccount.id;

    const entryId = crypto.randomUUID();
    entryRows.push({
      id: entryId,
      entryNumber: nextEntryNumber(taggedCashBook),
      date: rowDate,
      cashBook: taggedCashBook,
      entryType,
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
        accountId: taggedAccountId,
        debit: taggedIsDebit ? row.amount : 0,
        credit: taggedIsDebit ? 0 : row.amount,
        remark: row.keterangan,
        costCentre: row.costCentre || null,
        costDescription,
        isDebitSide: taggedIsDebit,
      },
      {
        id: crypto.randomUUID(),
        journalEntryId: entryId,
        accountId: otherAccountId,
        debit: taggedIsDebit ? 0 : row.amount,
        credit: taggedIsDebit ? row.amount : 0,
        remark: row.keterangan,
        costCentre: row.costCentre || null,
        costDescription,
        isDebitSide: !taggedIsDebit,
      },
    );
    if (row.dbcr === "DB") totalDebitRows += row.amount;
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

  // Remember only the EXPLICIT per-Keterangan overrides the user actually
  // picked (see the param doc above) — a small, bounded set, so plain
  // sequential upserts are fine here (no createMany equivalent for
  // "insert or update" in Prisma).
  for (const { keterangan, contraAccountId } of learnedMappings) {
    const keteranganKey = normalizeKeterangan(keterangan);
    await prisma.journalImportMapping.upsert({
      where: { keteranganKey },
      create: { keteranganKey, keterangan, contraAccountId, createdById },
      update: { contraAccountId, keterangan },
    });
  }

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
