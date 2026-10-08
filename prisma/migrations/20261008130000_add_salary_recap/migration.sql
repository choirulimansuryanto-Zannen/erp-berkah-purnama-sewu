-- Rekap Salary — monthly payroll recap per department, new section on
-- /finance/adjustment. Applied via `prisma db push` first; this file
-- backfills the migration record.

-- CreateEnum
CREATE TYPE "SalaryRecapDepartment" AS ENUM ('BOD', 'PRODUCTION', 'OPERATION', 'SALES_OFFICE', 'SALES_OUTLET', 'MARKETING', 'FA', 'HR_GA');

-- CreateTable
CREATE TABLE "SalaryRecap" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "department" "SalaryRecapDepartment" NOT NULL,
    "totalTerimaNet" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "koperasi" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "iuranBpjs" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "kasbon" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "pph21" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "adjLain" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "sanksi" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "insentifTjOutlet" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryRecap_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SalaryRecap_year_month_department_key" ON "SalaryRecap"("year", "month", "department");
CREATE INDEX "SalaryRecap_year_month_idx" ON "SalaryRecap"("year", "month");
ALTER TABLE "SalaryRecap" ADD CONSTRAINT "SalaryRecap_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
