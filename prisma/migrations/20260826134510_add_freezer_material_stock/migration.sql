-- CreateTable
CREATE TABLE "FreezerMaterial" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FreezerMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreezerStockRecord" (
    "id" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "freezerMaterialId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "openingBalance" INTEGER NOT NULL DEFAULT 0,
    "received" INTEGER NOT NULL DEFAULT 0,
    "used" INTEGER NOT NULL DEFAULT 0,
    "rejected" INTEGER NOT NULL DEFAULT 0,
    "closingBalance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FreezerStockRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FreezerMaterial_sortOrder_idx" ON "FreezerMaterial"("sortOrder");

-- CreateIndex
CREATE INDEX "FreezerStockRecord_outletId_date_idx" ON "FreezerStockRecord"("outletId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "FreezerStockRecord_outletId_freezerMaterialId_date_key" ON "FreezerStockRecord"("outletId", "freezerMaterialId", "date");

-- AddForeignKey
ALTER TABLE "FreezerStockRecord" ADD CONSTRAINT "FreezerStockRecord_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreezerStockRecord" ADD CONSTRAINT "FreezerStockRecord_freezerMaterialId_fkey" FOREIGN KEY ("freezerMaterialId") REFERENCES "FreezerMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
