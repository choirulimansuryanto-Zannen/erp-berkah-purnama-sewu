-- OutletPayroll: new editable fields for the "Summary Gaji & Tunjangan"
-- panel (Total Absen override + Share Value weight).
ALTER TABLE "OutletPayroll" ADD COLUMN "totalAbsenOverride" INTEGER;
ALTER TABLE "OutletPayroll" ADD COLUMN "refMultiplier" DECIMAL(6,3) NOT NULL DEFAULT 1;

-- OutletMonthlyBenefit: the 4 flat per-outlet-per-month BIAYA figures with
-- no other computed source yet (Tunjangan Outlet, Gaji Pengelola,
-- Fullshift, Insentive Operator placeholder).
CREATE TABLE "OutletMonthlyBenefit" (
    "id" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "tunjanganOutlet" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "gajiPengelola" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "fullshiftAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "insentiveOperatorAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutletMonthlyBenefit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OutletMonthlyBenefit_outletId_year_month_key" ON "OutletMonthlyBenefit"("outletId", "year", "month");
CREATE INDEX "OutletMonthlyBenefit_outletId_year_month_idx" ON "OutletMonthlyBenefit"("outletId", "year", "month");

ALTER TABLE "OutletMonthlyBenefit" ADD CONSTRAINT "OutletMonthlyBenefit_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OutletMonthlyBenefit" ADD CONSTRAINT "OutletMonthlyBenefit_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
