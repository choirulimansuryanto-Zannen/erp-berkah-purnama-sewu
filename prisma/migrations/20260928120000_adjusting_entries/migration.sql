-- Add non-cash "Jurnal Penyesuaian" (adjusting entry) support.

-- AlterEnum
ALTER TYPE "JournalEntryType" ADD VALUE 'JURNAL_PENYESUAIAN';

-- AlterTable
ALTER TABLE "JournalEntry" ALTER COLUMN "cashBook" DROP NOT NULL;
