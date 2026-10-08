-- Add directly-editable saldoAwalQty and totalBahanBakuQty to
-- CompanyMaterialClosingBalance — Nominal figures move to being always
-- derived (Qty × costPerUnit) instead of partially stored; Adjustment Qty
-- becomes the derived residual instead of a direct input. Applied via
-- `prisma db push` first; this file backfills the migration record.

ALTER TABLE "CompanyMaterialClosingBalance" ADD COLUMN "saldoAwalQty" DECIMAL(14,3) NOT NULL DEFAULT 0;
ALTER TABLE "CompanyMaterialClosingBalance" ADD COLUMN "totalBahanBakuQty" DECIMAL(14,3) NOT NULL DEFAULT 0;
