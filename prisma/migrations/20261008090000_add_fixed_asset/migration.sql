-- Itemized Fixed Asset register (FA Company menu, above Jurnal Penyesuaian).
-- Applied to the real database via `prisma db push` first (this project's
-- shadow-DB migration replay has a pre-existing, unrelated ordering issue —
-- 20260928120000_adjusting_entries ALTERs an enum that 20260929000000's
-- migration only creates later — so `migrate dev` cannot run until that
-- history is untangled); this file backfills the migration record so the
-- real schema and the migrations directory stay in sync going forward.

-- CreateEnum
CREATE TYPE "FixedAssetCategory" AS ENUM ('BANGUNAN_KANTOR', 'PERALATAN_KANTOR', 'BANGUNAN_PABRIK', 'PERALATAN_PABRIK', 'KENDARAAN');

-- CreateEnum
CREATE TYPE "FixedAssetStatus" AS ENUM ('ACTIVE', 'DISPOSED');

-- CreateTable
CREATE TABLE "FixedAsset" (
    "id" TEXT NOT NULL,
    "no" INTEGER,
    "category" "FixedAssetCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "acquisitionAmount" DECIMAL(16,2) NOT NULL,
    "depreciableBase" DECIMAL(16,2) NOT NULL,
    "usefulLifeMonths" INTEGER NOT NULL,
    "acquisitionDate" DATE NOT NULL,
    "remark" TEXT,
    "status" "FixedAssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FixedAsset_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FixedAsset_category_idx" ON "FixedAsset"("category");
CREATE INDEX "FixedAsset_status_idx" ON "FixedAsset"("status");
