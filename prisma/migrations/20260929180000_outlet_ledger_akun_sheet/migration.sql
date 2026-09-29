-- Akun Sheet rebuilt as a real day-by-day ledger: a fixed chart of
-- accounts (No. Akun 1-42) plus the transaction lines posted against it.

-- CreateEnum: LedgerSide
CREATE TYPE "LedgerSide" AS ENUM ('D', 'C');

-- CreateTable: OutletLedgerAccount
CREATE TABLE "OutletLedgerAccount" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "defaultSide" "LedgerSide" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutletLedgerAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OutletLedgerAccount_number_key" ON "OutletLedgerAccount"("number");
ALTER TABLE "OutletLedgerAccount" ADD CONSTRAINT "OutletLedgerAccount_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: OutletLedgerEntry
CREATE TABLE "OutletLedgerEntry" (
    "id" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "accountId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "side" "LedgerSide" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutletLedgerEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OutletLedgerEntry_outletId_date_idx" ON "OutletLedgerEntry"("outletId", "date");
CREATE INDEX "OutletLedgerEntry_accountId_date_idx" ON "OutletLedgerEntry"("accountId", "date");
ALTER TABLE "OutletLedgerEntry" ADD CONSTRAINT "OutletLedgerEntry_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OutletLedgerEntry" ADD CONSTRAINT "OutletLedgerEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "OutletLedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OutletLedgerEntry" ADD CONSTRAINT "OutletLedgerEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
