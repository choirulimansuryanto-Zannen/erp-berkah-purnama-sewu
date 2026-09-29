-- Laporan Outlet detail rebuild: per-product meat-usage tracking, expense
-- overhead grouping, a material/stock catalog, an Adjustment Sheet input,
-- and a configurable incentive bracket table.

-- AlterTable: Product
ALTER TABLE "Product" ADD COLUMN "usesDagingKetul" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "dagingKetulGramsPerUnit" DECIMAL(8,2) NOT NULL DEFAULT 0;

-- CreateEnum + AlterTable: ExpenseCategoryDef
CREATE TYPE "ExpenseOverheadGroup" AS ENUM ('DIRECT', 'INDIRECT', 'NONE');
ALTER TABLE "ExpenseCategoryDef" ADD COLUMN "overheadGroup" "ExpenseOverheadGroup" NOT NULL DEFAULT 'INDIRECT';

-- CreateEnum: OutletMaterialCategory
CREATE TYPE "OutletMaterialCategory" AS ENUM ('BAHAN_UTAMA', 'BAHAN_BAKU_TAMBAHAN', 'PACKAGING', 'BAHAN_ALAT_PENDUKUNG');

-- CreateTable: OutletMaterial
CREATE TABLE "OutletMaterial" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "OutletMaterialCategory" NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutletMaterial_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OutletMaterial_code_key" ON "OutletMaterial"("code");
CREATE INDEX "OutletMaterial_category_idx" ON "OutletMaterial"("category");
ALTER TABLE "OutletMaterial" ADD CONSTRAINT "OutletMaterial_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: OutletMaterialClosingBalance
CREATE TABLE "OutletMaterialClosingBalance" (
    "id" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "qty" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutletMaterialClosingBalance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OutletMaterialClosingBalance_outletId_materialId_year_mont_key" ON "OutletMaterialClosingBalance"("outletId", "materialId", "year", "month");
CREATE INDEX "OutletMaterialClosingBalance_outletId_year_month_idx" ON "OutletMaterialClosingBalance"("outletId", "year", "month");
ALTER TABLE "OutletMaterialClosingBalance" ADD CONSTRAINT "OutletMaterialClosingBalance_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OutletMaterialClosingBalance" ADD CONSTRAINT "OutletMaterialClosingBalance_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "OutletMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OutletMaterialClosingBalance" ADD CONSTRAINT "OutletMaterialClosingBalance_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateEnum + AlterTable: OutletPurchase
CREATE TYPE "OutletPurchaseCategory" AS ENUM ('BAHAN', 'BAHAN_EKSTERNAL', 'BAHAN_PENDUKUNG', 'SAYUR', 'GAS', 'ANGKUT', 'POTONGAN', 'LAINNYA');
ALTER TABLE "OutletPurchase" ADD COLUMN "category" "OutletPurchaseCategory" NOT NULL DEFAULT 'BAHAN';
ALTER TABLE "OutletPurchase" ADD COLUMN "materialId" TEXT;
CREATE INDEX "OutletPurchase_materialId_date_idx" ON "OutletPurchase"("materialId", "date");
ALTER TABLE "OutletPurchase" ADD CONSTRAINT "OutletPurchase_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "OutletMaterial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum + CreateTable: OutletAdjustment
CREATE TYPE "OutletAdjustmentType" AS ENUM ('RUSAK', 'REJECT', 'SELISIH');
CREATE TABLE "OutletAdjustment" (
    "id" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" "OutletAdjustmentType" NOT NULL,
    "materialId" TEXT,
    "description" TEXT NOT NULL,
    "qty" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutletAdjustment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OutletAdjustment_outletId_date_idx" ON "OutletAdjustment"("outletId", "date");
CREATE INDEX "OutletAdjustment_materialId_date_idx" ON "OutletAdjustment"("materialId", "date");
ALTER TABLE "OutletAdjustment" ADD CONSTRAINT "OutletAdjustment_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OutletAdjustment" ADD CONSTRAINT "OutletAdjustment_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "OutletMaterial"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OutletAdjustment" ADD CONSTRAINT "OutletAdjustment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: IncentiveBracket
CREATE TABLE "IncentiveBracket" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "rangeMin" DECIMAL(14,2) NOT NULL,
    "rangeMax" DECIMAL(14,2),
    "rateSinglePic" DECIMAL(6,3) NOT NULL,
    "rateMultiPic" DECIMAL(6,3) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncentiveBracket_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "IncentiveBracket" ADD CONSTRAINT "IncentiveBracket_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
