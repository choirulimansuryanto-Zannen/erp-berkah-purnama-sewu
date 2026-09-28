-- DropForeignKey
ALTER TABLE "AttendanceParticipant" DROP CONSTRAINT "AttendanceParticipant_attendanceRecordId_fkey";

-- DropForeignKey
ALTER TABLE "AttendanceParticipant" DROP CONSTRAINT "AttendanceParticipant_pramuniagaRosterId_fkey";

-- DropIndex
DROP INDEX "AttendanceRecord_userId_date_key";

-- DropIndex
DROP INDEX "OperationalChecklistSubmission_itemId_outletId_date_key";

-- AlterTable
ALTER TABLE "OperationalChecklistSubmission" ADD COLUMN     "pramuniagaRosterId" TEXT;

-- DropTable
DROP TABLE "AttendanceParticipant";

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_userId_date_pramuniagaRosterId_key" ON "AttendanceRecord"("userId", "date", "pramuniagaRosterId");

-- CreateIndex
CREATE UNIQUE INDEX "OperationalChecklistSubmission_itemId_outletId_date_pramuni_key" ON "OperationalChecklistSubmission"("itemId", "outletId", "date", "pramuniagaRosterId");

-- AddForeignKey
ALTER TABLE "OperationalChecklistSubmission" ADD CONSTRAINT "OperationalChecklistSubmission_pramuniagaRosterId_fkey" FOREIGN KEY ("pramuniagaRosterId") REFERENCES "PramuniagaRoster"("id") ON DELETE SET NULL ON UPDATE CASCADE;
