-- Company-wide (warehouse-level) material catalog + monthly SKU-level
-- stock-opname snapshot, backing the "Riwayat Persediaan Akhir" detail
-- table on /finance/persediaan. Applied via `prisma db push` first (see
-- 20261008090000_add_fixed_asset for why migrate dev can't run); this file
-- backfills the migration record.

-- CreateEnum
CREATE TYPE "CompanyMaterialCategory" AS ENUM ('DAGING', 'ROTI', 'LABANESE', 'BAHAN_BAKU_TAMBAHAN', 'BAHAN_PENDUKUNG', 'PACKAGING_AB', 'BAHAN_BAKU_AD', 'BAHAN_CAMPURAN_AD', 'PACKAGING_AD', 'BARANG_JADI_AD', 'MARKETING_TOOLS');

-- CreateTable
CREATE TABLE "CompanyMaterial" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "CompanyMaterialCategory" NOT NULL,
    "unit" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyMaterial_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CompanyMaterial_code_key" ON "CompanyMaterial"("code");
CREATE INDEX "CompanyMaterial_category_idx" ON "CompanyMaterial"("category");

-- CreateTable
CREATE TABLE "CompanyMaterialClosingBalance" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "qtyOpname" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "costPerUnit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "adjustmentNilai" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "fakturOutletQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "fakturOutletNominal" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyMaterialClosingBalance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CompanyMaterialClosingBalance_materialId_year_month_key" ON "CompanyMaterialClosingBalance"("materialId", "year", "month");
CREATE INDEX "CompanyMaterialClosingBalance_year_month_idx" ON "CompanyMaterialClosingBalance"("year", "month");
ALTER TABLE "CompanyMaterialClosingBalance" ADD CONSTRAINT "CompanyMaterialClosingBalance_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "CompanyMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyMaterialClosingBalance" ADD CONSTRAINT "CompanyMaterialClosingBalance_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
