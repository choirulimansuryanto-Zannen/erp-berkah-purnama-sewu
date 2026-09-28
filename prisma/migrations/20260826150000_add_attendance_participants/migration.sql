-- AlterTable
ALTER TABLE "Outlet" ADD COLUMN     "maxPramuniagaPerShift" INTEGER NOT NULL DEFAULT 4;

-- CreateTable
CREATE TABLE "AttendanceParticipant" (
    "id" TEXT NOT NULL,
    "attendanceRecordId" TEXT NOT NULL,
    "pramuniagaRosterId" TEXT NOT NULL,
    "gpsIn" TEXT,
    "photoUrl" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceParticipant_attendanceRecordId_idx" ON "AttendanceParticipant"("attendanceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceParticipant_attendanceRecordId_pramuniagaRosterId_key" ON "AttendanceParticipant"("attendanceRecordId", "pramuniagaRosterId");

-- AddForeignKey
ALTER TABLE "AttendanceParticipant" ADD CONSTRAINT "AttendanceParticipant_attendanceRecordId_fkey" FOREIGN KEY ("attendanceRecordId") REFERENCES "AttendanceRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceParticipant" ADD CONSTRAINT "AttendanceParticipant_pramuniagaRosterId_fkey" FOREIGN KEY ("pramuniagaRosterId") REFERENCES "PramuniagaRoster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
