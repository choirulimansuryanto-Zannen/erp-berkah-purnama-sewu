-- CreateEnum
CREATE TYPE "OutletInvestorShareType" AS ENUM ('PERSEN', 'NOMINAL');

-- CreateTable
CREATE TABLE "OutletInvestorProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "openingBalance" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutletInvestorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutletInvestorShare" (
    "id" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "slotNumber" INTEGER NOT NULL,
    "shareType" "OutletInvestorShareType" NOT NULL,
    "shareValue" DECIMAL(14,3) NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutletInvestorShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutletInvestorMonthlyLedger" (
    "id" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "adj" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "accumOverride" DECIMAL(16,2),
    "transferSharedOverride" DECIMAL(16,2),
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutletInvestorMonthlyLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OutletInvestorShare_outletId_slotNumber_key" ON "OutletInvestorShare"("outletId", "slotNumber");
CREATE INDEX "OutletInvestorShare_investorId_idx" ON "OutletInvestorShare"("investorId");
CREATE UNIQUE INDEX "OutletInvestorMonthlyLedger_investorId_year_month_key" ON "OutletInvestorMonthlyLedger"("investorId", "year", "month");
CREATE INDEX "OutletInvestorMonthlyLedger_investorId_year_month_idx" ON "OutletInvestorMonthlyLedger"("investorId", "year", "month");

-- AddForeignKey
ALTER TABLE "OutletInvestorProfile" ADD CONSTRAINT "OutletInvestorProfile_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OutletInvestorShare" ADD CONSTRAINT "OutletInvestorShare_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "OutletInvestorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OutletInvestorShare" ADD CONSTRAINT "OutletInvestorShare_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OutletInvestorShare" ADD CONSTRAINT "OutletInvestorShare_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OutletInvestorMonthlyLedger" ADD CONSTRAINT "OutletInvestorMonthlyLedger_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "OutletInvestorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OutletInvestorMonthlyLedger" ADD CONSTRAINT "OutletInvestorMonthlyLedger_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
