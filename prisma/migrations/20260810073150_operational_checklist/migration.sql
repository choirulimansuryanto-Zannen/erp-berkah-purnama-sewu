-- CreateTable
CREATE TABLE "OperationalChecklistItem" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subLabel" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationalChecklistSubmission" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "photoUrl" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationalChecklistSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OperationalChecklistSubmission_outletId_date_idx" ON "OperationalChecklistSubmission"("outletId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "OperationalChecklistSubmission_itemId_outletId_date_key" ON "OperationalChecklistSubmission"("itemId", "outletId", "date");

-- AddForeignKey
ALTER TABLE "OperationalChecklistSubmission" ADD CONSTRAINT "OperationalChecklistSubmission_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "OperationalChecklistItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalChecklistSubmission" ADD CONSTRAINT "OperationalChecklistSubmission_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalChecklistSubmission" ADD CONSTRAINT "OperationalChecklistSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
