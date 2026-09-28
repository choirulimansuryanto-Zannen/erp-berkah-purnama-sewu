-- CreateTable
CREATE TABLE "Topping" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Topping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionItemTopping" (
    "id" TEXT NOT NULL,
    "transactionItemId" TEXT NOT NULL,
    "toppingId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "TransactionItemTopping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransactionItemTopping_transactionItemId_idx" ON "TransactionItemTopping"("transactionItemId");

-- AddForeignKey
ALTER TABLE "TransactionItemTopping" ADD CONSTRAINT "TransactionItemTopping_transactionItemId_fkey" FOREIGN KEY ("transactionItemId") REFERENCES "TransactionItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionItemTopping" ADD CONSTRAINT "TransactionItemTopping_toppingId_fkey" FOREIGN KEY ("toppingId") REFERENCES "Topping"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
