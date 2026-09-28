-- AlterTable
ALTER TABLE "OutletMonthlyTarget" ADD COLUMN     "fullshiftDailyTarget" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "insentifDailyTarget" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "insentifMonthlyTarget" DECIMAL(14,2) NOT NULL DEFAULT 0;
