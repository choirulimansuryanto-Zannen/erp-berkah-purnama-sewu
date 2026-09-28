-- CreateTable
CREATE TABLE "PackageComponent" (
    "id" TEXT NOT NULL,
    "packageProductId" TEXT NOT NULL,
    "componentProductId" TEXT,
    "componentToppingId" TEXT,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackageComponent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PackageComponent_packageProductId_idx" ON "PackageComponent"("packageProductId");

-- AddForeignKey
ALTER TABLE "PackageComponent" ADD CONSTRAINT "PackageComponent_packageProductId_fkey" FOREIGN KEY ("packageProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageComponent" ADD CONSTRAINT "PackageComponent_componentProductId_fkey" FOREIGN KEY ("componentProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageComponent" ADD CONSTRAINT "PackageComponent_componentToppingId_fkey" FOREIGN KEY ("componentToppingId") REFERENCES "Topping"("id") ON DELETE SET NULL ON UPDATE CASCADE;

