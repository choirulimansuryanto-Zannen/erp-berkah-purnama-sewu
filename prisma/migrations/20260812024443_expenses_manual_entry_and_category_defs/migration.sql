-- AlterTable
ALTER TABLE "ExpenseRecord" DROP COLUMN "category",
ADD COLUMN     "category" TEXT NOT NULL;

-- DropEnum
DROP TYPE "ExpenseCategory";

-- CreateTable
CREATE TABLE "ExpenseCategoryDef" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseCategoryDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseManualEntry" (
    "id" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "pramuniagaId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "gofoodAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grabAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "shopeeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tiktokAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "qponAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cashlessAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "qtyKopdes" INTEGER NOT NULL DEFAULT 0,
    "qtyMbg" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseManualEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategoryDef_key_key" ON "ExpenseCategoryDef"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseManualEntry_outletId_pramuniagaId_date_key" ON "ExpenseManualEntry"("outletId", "pramuniagaId", "date");

-- AddForeignKey
ALTER TABLE "ExpenseRecord" ADD CONSTRAINT "ExpenseRecord_category_fkey" FOREIGN KEY ("category") REFERENCES "ExpenseCategoryDef"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseCategoryDef" ADD CONSTRAINT "ExpenseCategoryDef_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseManualEntry" ADD CONSTRAINT "ExpenseManualEntry_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseManualEntry" ADD CONSTRAINT "ExpenseManualEntry_pramuniagaId_fkey" FOREIGN KEY ("pramuniagaId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

