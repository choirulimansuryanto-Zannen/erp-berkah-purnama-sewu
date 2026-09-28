-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN     "pramuniagaRosterId" TEXT,
ADD COLUMN     "shift" "Shift" NOT NULL DEFAULT 'FULLSHIFT';

-- CreateTable
CREATE TABLE "PramuniagaRoster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PramuniagaRoster_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_pramuniagaRosterId_fkey" FOREIGN KEY ("pramuniagaRosterId") REFERENCES "PramuniagaRoster"("id") ON DELETE SET NULL ON UPDATE CASCADE;
