-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'OFFICE';

-- AlterTable
ALTER TABLE "Outlet" ADD COLUMN     "pramuniagaSlots" INTEGER NOT NULL DEFAULT 1;
