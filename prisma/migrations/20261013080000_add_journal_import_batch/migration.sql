-- CreateTable
CREATE TABLE "JournalImportBatch" (
    "id" TEXT NOT NULL,
    "cashBook" "CashBook" NOT NULL,
    "fileName" TEXT,
    "targetYear" INTEGER NOT NULL,
    "targetMonth" INTEGER NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "totalDebitRows" DECIMAL(16,2) NOT NULL,
    "totalCreditRows" DECIMAL(16,2) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalImportBatch_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "JournalEntry" ADD COLUMN "importBatchId" TEXT;

-- CreateIndex
CREATE INDEX "JournalImportBatch_createdAt_idx" ON "JournalImportBatch"("createdAt");
CREATE INDEX "JournalEntry_importBatchId_idx" ON "JournalEntry"("importBatchId");

-- AddForeignKey
ALTER TABLE "JournalImportBatch" ADD CONSTRAINT "JournalImportBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "JournalImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
