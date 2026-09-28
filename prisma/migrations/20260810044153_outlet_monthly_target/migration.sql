-- CreateTable
CREATE TABLE "OutletMonthlyTarget" (
    "id" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "monthlyTarget" DECIMAL(14,2) NOT NULL,
    "dailyTarget" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutletMonthlyTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OutletMonthlyTarget_outletId_year_idx" ON "OutletMonthlyTarget"("outletId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "OutletMonthlyTarget_outletId_year_month_key" ON "OutletMonthlyTarget"("outletId", "year", "month");

-- AddForeignKey
ALTER TABLE "OutletMonthlyTarget" ADD CONSTRAINT "OutletMonthlyTarget_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
