-- CreateTable
CREATE TABLE "JournalImportMapping" (
    "id" TEXT NOT NULL,
    "keterangan" TEXT NOT NULL,
    "keteranganKey" TEXT NOT NULL,
    "contraAccountId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalImportMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JournalImportMapping_keteranganKey_key" ON "JournalImportMapping"("keteranganKey");

-- AddForeignKey
ALTER TABLE "JournalImportMapping" ADD CONSTRAINT "JournalImportMapping_contraAccountId_fkey" FOREIGN KEY ("contraAccountId") REFERENCES "ChartOfAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JournalImportMapping" ADD CONSTRAINT "JournalImportMapping_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
