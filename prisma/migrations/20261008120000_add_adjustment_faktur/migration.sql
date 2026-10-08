-- Add Adjustment Faktur 01.<prior month> Outlet columns to
-- CompanyMaterialClosingBalance (corrects a prior month's Faktur figure,
-- distinct from adjustmentNilai which only corrects this month's own
-- valuation rounding). Applied via `prisma db push` first; this file
-- backfills the migration record.

ALTER TABLE "CompanyMaterialClosingBalance" ADD COLUMN "adjustmentFakturQty" DECIMAL(14,3) NOT NULL DEFAULT 0;
ALTER TABLE "CompanyMaterialClosingBalance" ADD COLUMN "adjustmentFakturNominal" DECIMAL(16,2) NOT NULL DEFAULT 0;
