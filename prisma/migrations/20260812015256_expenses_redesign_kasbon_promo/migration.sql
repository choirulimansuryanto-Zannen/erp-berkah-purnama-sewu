-- AlterEnum
BEGIN;
CREATE TYPE "ExpenseCategory_new" AS ENUM ('SAYUR', 'MENTEGA', 'GAS_3KG', 'BENSIN', 'SUNLIGHT', 'TISSUE', 'GLOVE', 'KERTAS_ROTI', 'KEJU_SLICE', 'FOTOCOPY', 'ALAT_TULIS', 'PAKET_DATA', 'IURAN_OUTLET', 'IURAN_MESS', 'TOKEN_LISTRIK_MESS', 'TOKEN_LISTRIK_OUTLET', 'SERVICE_MOTOR', 'PERALATAN_OUTLET', 'PERBAIKAN_OUTLET', 'SEWA_TENANT', 'SEWA_MESS', 'ISI_ULANG_GALON', 'PLASTIK', 'PLASTIK_SAMPAH', 'MINUMAN', 'LAIN_LAIN');
ALTER TABLE "ExpenseRecord" ALTER COLUMN "category" TYPE "ExpenseCategory_new" USING ("category"::text::"ExpenseCategory_new");
ALTER TYPE "ExpenseCategory" RENAME TO "ExpenseCategory_old";
ALTER TYPE "ExpenseCategory_new" RENAME TO "ExpenseCategory";
DROP TYPE "public"."ExpenseCategory_old";
COMMIT;

-- AlterTable
ALTER TABLE "BusinessSettings" ADD COLUMN     "paketHematKopdesDiscount" DECIMAL(10,2) NOT NULL DEFAULT 3000,
ADD COLUMN     "paketHematMbgDiscount" DECIMAL(10,2) NOT NULL DEFAULT 5000;

-- AlterTable
ALTER TABLE "ExpenseRecord" ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "receiptUrl" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Kasbon" (
    "id" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "pramuniagaId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Kasbon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoDiscount" (
    "id" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "pramuniagaId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromoDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Kasbon_outletId_date_idx" ON "Kasbon"("outletId", "date");

-- CreateIndex
CREATE INDEX "Kasbon_pramuniagaId_idx" ON "Kasbon"("pramuniagaId");

-- CreateIndex
CREATE UNIQUE INDEX "PromoDiscount_outletId_pramuniagaId_date_key" ON "PromoDiscount"("outletId", "pramuniagaId", "date");

-- AddForeignKey
ALTER TABLE "Kasbon" ADD CONSTRAINT "Kasbon_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kasbon" ADD CONSTRAINT "Kasbon_pramuniagaId_fkey" FOREIGN KEY ("pramuniagaId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoDiscount" ADD CONSTRAINT "PromoDiscount_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoDiscount" ADD CONSTRAINT "PromoDiscount_pramuniagaId_fkey" FOREIGN KEY ("pramuniagaId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

