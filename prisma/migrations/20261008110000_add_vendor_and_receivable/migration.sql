-- Buku Hutang Vendor (Vendor + VendorLedgerEntry) and Buku Pencatatan
-- Piutang (ReceivableEntry), FA Company menus above Fixed Asset. Applied via
-- `prisma db push` first (see 20261008090000_add_fixed_asset for why
-- migrate dev can't run); this file backfills the migration record.

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorLedgerEntry" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "hutang" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "bayar" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorLedgerEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VendorLedgerEntry_vendorId_date_idx" ON "VendorLedgerEntry"("vendorId", "date");
ALTER TABLE "VendorLedgerEntry" ADD CONSTRAINT "VendorLedgerEntry_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VendorLedgerEntry" ADD CONSTRAINT "VendorLedgerEntry_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "ReceivableGroup" AS ENUM ('OUTLET', 'MITRA', 'SAYUR', 'KOBAR', 'MANGKACAU', 'TORTILLA', 'MIE_STEAK');

-- CreateTable
CREATE TABLE "ReceivableEntry" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "mitraCode" TEXT NOT NULL,
    "mitraName" TEXT NOT NULL,
    "noFaktur" TEXT,
    "tglFaktur" DATE,
    "description" TEXT NOT NULL,
    "debt" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "group" "ReceivableGroup" NOT NULL,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceivableEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReceivableEntry_date_idx" ON "ReceivableEntry"("date");
CREATE INDEX "ReceivableEntry_group_idx" ON "ReceivableEntry"("group");
ALTER TABLE "ReceivableEntry" ADD CONSTRAINT "ReceivableEntry_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
