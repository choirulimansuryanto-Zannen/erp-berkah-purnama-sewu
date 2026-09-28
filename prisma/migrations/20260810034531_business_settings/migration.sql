-- CreateTable
CREATE TABLE "BusinessSettings" (
    "id" TEXT NOT NULL,
    "expenseAutoApproveLimit" DECIMAL(12,2) NOT NULL DEFAULT 500000,
    "posDiscountSpvThresholdPercent" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "voidWindowMinutes" INTEGER NOT NULL DEFAULT 30,
    "cashVarianceAutoApprove" DECIMAL(12,2) NOT NULL DEFAULT 10000,
    "cashVarianceSpvReview" DECIMAL(12,2) NOT NULL DEFAULT 50000,
    "memberAnnualSpendWindowDays" INTEGER NOT NULL DEFAULT 365,
    "loyaltySilverThreshold" DECIMAL(14,2) NOT NULL DEFAULT 500000,
    "loyaltyGoldThreshold" DECIMAL(14,2) NOT NULL DEFAULT 2000000,
    "loyaltyBronzeMultiplier" DECIMAL(4,2) NOT NULL DEFAULT 1,
    "loyaltySilverMultiplier" DECIMAL(4,2) NOT NULL DEFAULT 1.2,
    "loyaltyGoldMultiplier" DECIMAL(4,2) NOT NULL DEFAULT 1.5,
    "loyaltyPointsPerRupiah" DECIMAL(8,4) NOT NULL DEFAULT 1,
    "loyaltyRupiahPerPointRedeemed" DECIMAL(10,2) NOT NULL DEFAULT 100,
    "stockUnitTolerance" INTEGER NOT NULL DEFAULT 5,
    "stockPercentTolerance" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "inventoryEscalationUnits" INTEGER NOT NULL DEFAULT 10,
    "expiryWarningDays" INTEGER NOT NULL DEFAULT 30,
    "businessHourStart" INTEGER NOT NULL DEFAULT 9,
    "businessHourEnd" INTEGER NOT NULL DEFAULT 21,
    "pacingRedThresholdPercent" DECIMAL(5,2) NOT NULL DEFAULT 70,
    "pacingYellowThresholdPercent" DECIMAL(5,2) NOT NULL DEFAULT 90,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessSettings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "BusinessSettings" ADD CONSTRAINT "BusinessSettings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
