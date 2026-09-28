-- CreateEnum
CREATE TYPE "Shift" AS ENUM ('SHIFT_1', 'SHIFT_2', 'FULLSHIFT');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "shift" "Shift" NOT NULL DEFAULT 'FULLSHIFT';

-- AlterTable
ALTER TABLE "Outlet" DROP COLUMN "pramuniagaSlots";
