-- CreateEnum
CREATE TYPE "RawMaterialGroup" AS ENUM ('DAGING', 'SAYUR', 'SAOS_KEMASAN');

-- CreateTable
CREATE TABLE "RawMaterial" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "group" "RawMaterialGroup" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RawMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyReportStockLine" (
    "id" TEXT NOT NULL,
    "dailyReportId" TEXT NOT NULL,
    "productId" TEXT,
    "toppingId" TEXT,
    "itemName" TEXT NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "ambil" INTEGER NOT NULL DEFAULT 0,
    "sisa" INTEGER NOT NULL DEFAULT 0,
    "terjualSistem" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DailyReportStockLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyReportMaterialLine" (
    "id" TEXT NOT NULL,
    "dailyReportId" TEXT NOT NULL,
    "rawMaterialId" TEXT NOT NULL,
    "qtyUsed" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "DailyReportMaterialLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RawMaterial_group_idx" ON "RawMaterial"("group");

-- CreateIndex
CREATE INDEX "DailyReportStockLine_dailyReportId_idx" ON "DailyReportStockLine"("dailyReportId");

-- CreateIndex
CREATE INDEX "DailyReportMaterialLine_dailyReportId_idx" ON "DailyReportMaterialLine"("dailyReportId");

-- CreateIndex
CREATE INDEX "DailyReportMaterialLine_rawMaterialId_idx" ON "DailyReportMaterialLine"("rawMaterialId");

-- AddForeignKey
ALTER TABLE "DailyReportStockLine" ADD CONSTRAINT "DailyReportStockLine_dailyReportId_fkey" FOREIGN KEY ("dailyReportId") REFERENCES "DailyReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReportStockLine" ADD CONSTRAINT "DailyReportStockLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReportStockLine" ADD CONSTRAINT "DailyReportStockLine_toppingId_fkey" FOREIGN KEY ("toppingId") REFERENCES "Topping"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReportMaterialLine" ADD CONSTRAINT "DailyReportMaterialLine_dailyReportId_fkey" FOREIGN KEY ("dailyReportId") REFERENCES "DailyReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReportMaterialLine" ADD CONSTRAINT "DailyReportMaterialLine_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "RawMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
