-- AlterTable
ALTER TABLE "Kasbon" ADD COLUMN     "pramuniagaRosterId" TEXT;

-- AddForeignKey
ALTER TABLE "Kasbon" ADD CONSTRAINT "Kasbon_pramuniagaRosterId_fkey" FOREIGN KEY ("pramuniagaRosterId") REFERENCES "PramuniagaRoster"("id") ON DELETE SET NULL ON UPDATE CASCADE;
