-- CreateTable
CREATE TABLE "JournalImportDefaultAccount" (
    "id" TEXT NOT NULL,
    "cashBook" "CashBook" NOT NULL,
    "defaultDbAccountId" TEXT,
    "defaultCrAccountId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalImportDefaultAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JournalImportDefaultAccount_cashBook_key" ON "JournalImportDefaultAccount"("cashBook");

-- AddForeignKey
ALTER TABLE "JournalImportDefaultAccount" ADD CONSTRAINT "JournalImportDefaultAccount_defaultDbAccountId_fkey" FOREIGN KEY ("defaultDbAccountId") REFERENCES "ChartOfAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JournalImportDefaultAccount" ADD CONSTRAINT "JournalImportDefaultAccount_defaultCrAccountId_fkey" FOREIGN KEY ("defaultCrAccountId") REFERENCES "ChartOfAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
