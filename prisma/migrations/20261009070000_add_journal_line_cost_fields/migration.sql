-- Per-line fields for the Jurnal Penyesuaian spreadsheet-style grid.
ALTER TABLE "JournalEntryLine" ADD COLUMN "remark" TEXT;
ALTER TABLE "JournalEntryLine" ADD COLUMN "costDescription" TEXT;
ALTER TABLE "JournalEntryLine" ADD COLUMN "costCentre" TEXT;
ALTER TABLE "JournalEntryLine" ADD COLUMN "isDebitSide" BOOLEAN NOT NULL DEFAULT true;
