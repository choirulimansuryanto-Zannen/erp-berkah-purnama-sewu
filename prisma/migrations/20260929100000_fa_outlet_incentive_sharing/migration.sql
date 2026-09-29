-- FA Outlet: incentives, sharing profit, direct outlet purchases.

-- CreateEnum
CREATE TYPE "IncentiveRuleType" AS ENUM ('PRAMU', 'SPV', 'PENGELOLA', 'OFFICER_SALES', 'HEAD_SALES', 'OFFICER_MARKETING', 'HEAD_MARKETING', 'HEAD_FA', 'HEAD_OPERASIONAL', 'MANAGEMENT');

-- CreateEnum
CREATE TYPE "IncentiveScope" AS ENUM ('OUTLET', 'REGION', 'COMPANY');

-- CreateEnum
CREATE TYPE "IncentiveBasis" AS ENUM ('PERSEN_OMSET', 'PERSEN_LABA_KOTOR', 'PERSEN_LABA_BERSIH', 'NOMINAL_TETAP');

-- CreateTable
CREATE TABLE "IncentiveRule" (
    "id" TEXT NOT NULL,
    "type" "IncentiveRuleType" NOT NULL,
    "scope" "IncentiveScope" NOT NULL,
    "basis" "IncentiveBasis" NOT NULL,
    "rate" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncentiveRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncentiveCalculation" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "type" "IncentiveRuleType" NOT NULL,
    "scope" "IncentiveScope" NOT NULL,
    "outletId" TEXT,
    "regionId" TEXT,
    "ruleId" TEXT NOT NULL,
    "basis" "IncentiveBasis" NOT NULL,
    "rateSnapshot" DECIMAL(14,4) NOT NULL,
    "baseAmount" DECIMAL(16,2) NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "calculatedById" TEXT NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncentiveCalculation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Investor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownershipPct" DECIMAL(6,3) NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Investor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharingProfitRule" (
    "id" TEXT NOT NULL,
    "rate" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharingProfitRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharingProfitDistribution" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "labaBersih" DECIMAL(16,2) NOT NULL,
    "poolRate" DECIMAL(6,3) NOT NULL,
    "poolAmount" DECIMAL(16,2) NOT NULL,
    "investorId" TEXT NOT NULL,
    "ownershipSnapshot" DECIMAL(6,3) NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "calculatedById" TEXT NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharingProfitDistribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutletPurchase" (
    "id" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "qty" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "amount" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutletPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IncentiveRule_type_key" ON "IncentiveRule"("type");

-- CreateIndex
CREATE UNIQUE INDEX "IncentiveCalculation_year_month_type_outletId_regionId_key" ON "IncentiveCalculation"("year", "month", "type", "outletId", "regionId");

-- CreateIndex
CREATE INDEX "IncentiveCalculation_year_month_idx" ON "IncentiveCalculation"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "SharingProfitDistribution_year_month_investorId_key" ON "SharingProfitDistribution"("year", "month", "investorId");

-- CreateIndex
CREATE INDEX "SharingProfitDistribution_year_month_idx" ON "SharingProfitDistribution"("year", "month");

-- CreateIndex
CREATE INDEX "OutletPurchase_outletId_date_idx" ON "OutletPurchase"("outletId", "date");

-- AddForeignKey
ALTER TABLE "IncentiveRule" ADD CONSTRAINT "IncentiveRule_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncentiveCalculation" ADD CONSTRAINT "IncentiveCalculation_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncentiveCalculation" ADD CONSTRAINT "IncentiveCalculation_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncentiveCalculation" ADD CONSTRAINT "IncentiveCalculation_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "IncentiveRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncentiveCalculation" ADD CONSTRAINT "IncentiveCalculation_calculatedById_fkey" FOREIGN KEY ("calculatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Investor" ADD CONSTRAINT "Investor_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharingProfitRule" ADD CONSTRAINT "SharingProfitRule_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharingProfitDistribution" ADD CONSTRAINT "SharingProfitDistribution_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharingProfitDistribution" ADD CONSTRAINT "SharingProfitDistribution_calculatedById_fkey" FOREIGN KEY ("calculatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutletPurchase" ADD CONSTRAINT "OutletPurchase_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutletPurchase" ADD CONSTRAINT "OutletPurchase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
