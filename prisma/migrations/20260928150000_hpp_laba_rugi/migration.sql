-- Detailed Laporan HPP + Laporan Laba-Rugi restructure: periodic-inventory
-- stock-opname closing balances (Persediaan Akhir input at month-end).

-- CreateEnum
CREATE TYPE "InventoryCategory" AS ENUM ('BAHAN_BAKU', 'BAHAN_SETENGAH_JADI', 'BARANG_JADI', 'BAHAN_PENDUKUNG', 'PROYEK_DALAM_PENYELESAIAN');

-- CreateTable
CREATE TABLE "InventoryClosingBalance" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "category" "InventoryCategory" NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryClosingBalance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryClosingBalance_year_month_category_key" ON "InventoryClosingBalance"("year", "month", "category");

-- CreateIndex
CREATE INDEX "InventoryClosingBalance_year_month_idx" ON "InventoryClosingBalance"("year", "month");

-- AddForeignKey
ALTER TABLE "InventoryClosingBalance" ADD CONSTRAINT "InventoryClosingBalance_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
