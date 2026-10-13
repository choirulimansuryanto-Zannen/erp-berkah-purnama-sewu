-- CreateTable
CREATE TABLE "CashBookOfficer" (
    "id" TEXT NOT NULL,
    "cashBook" "CashBook" NOT NULL,
    "officerName" TEXT NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashBookOfficer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CashBookOfficer_cashBook_key" ON "CashBookOfficer"("cashBook");

-- AddForeignKey
ALTER TABLE "CashBookOfficer" ADD CONSTRAINT "CashBookOfficer_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
