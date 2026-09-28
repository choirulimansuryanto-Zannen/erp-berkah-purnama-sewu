-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "code" TEXT,
ADD COLUMN     "birthDate" DATE,
ADD COLUMN     "city" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Member_code_key" ON "Member"("code");
