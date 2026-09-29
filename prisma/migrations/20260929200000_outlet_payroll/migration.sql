-- Absen Sheet's Labor Cost / Salary — manually entered per pramuniaga per
-- month (no wage-rate/HR data model exists to compute them from).

CREATE TABLE "OutletPayroll" (
    "id" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "laborCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "salary" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutletPayroll_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OutletPayroll_outletId_userId_year_month_key" ON "OutletPayroll"("outletId", "userId", "year", "month");
CREATE INDEX "OutletPayroll_outletId_year_month_idx" ON "OutletPayroll"("outletId", "year", "month");
ALTER TABLE "OutletPayroll" ADD CONSTRAINT "OutletPayroll_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OutletPayroll" ADD CONSTRAINT "OutletPayroll_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OutletPayroll" ADD CONSTRAINT "OutletPayroll_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
