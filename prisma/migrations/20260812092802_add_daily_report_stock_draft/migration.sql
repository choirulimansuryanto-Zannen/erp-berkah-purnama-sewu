-- CreateTable
CREATE TABLE "DailyReportStockDraft" (
    "id" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "pramuniagaId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "itemIndex" INTEGER NOT NULL,
    "ambil" INTEGER NOT NULL DEFAULT 0,
    "sisa" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyReportStockDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyReportStockDraft_outletId_pramuniagaId_date_itemIndex_key" ON "DailyReportStockDraft"("outletId", "pramuniagaId", "date", "itemIndex");

-- AddForeignKey
ALTER TABLE "DailyReportStockDraft" ADD CONSTRAINT "DailyReportStockDraft_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReportStockDraft" ADD CONSTRAINT "DailyReportStockDraft_pramuniagaId_fkey" FOREIGN KEY ("pramuniagaId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

