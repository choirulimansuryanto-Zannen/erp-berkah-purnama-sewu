-- CreateTable
CREATE TABLE "DailyReportMaterialDraft" (
    "id" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "pramuniagaId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "rawMaterialId" TEXT NOT NULL,
    "qtyUsed" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyReportMaterialDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyReportMaterialDraft_outletId_pramuniagaId_date_rawMate_key" ON "DailyReportMaterialDraft"("outletId", "pramuniagaId", "date", "rawMaterialId");

-- AddForeignKey
ALTER TABLE "DailyReportMaterialDraft" ADD CONSTRAINT "DailyReportMaterialDraft_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReportMaterialDraft" ADD CONSTRAINT "DailyReportMaterialDraft_pramuniagaId_fkey" FOREIGN KEY ("pramuniagaId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReportMaterialDraft" ADD CONSTRAINT "DailyReportMaterialDraft_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "RawMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
