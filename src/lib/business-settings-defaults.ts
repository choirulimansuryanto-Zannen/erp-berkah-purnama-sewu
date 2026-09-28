// Pure constants — deliberately has NO imports (no "server-only", no
// prisma) so pure unit tests (loyalty/reconciliation/inventory/pacing) can
// import DEFAULT_BUSINESS_SETTINGS without pulling in a real PrismaClient
// instantiation. The DB-backed fetch lives in business-settings.ts, which
// re-exports these for server-side callers.
export const DEFAULT_BUSINESS_SETTINGS = {
  // Finance & POS
  expenseAutoApproveLimit: 500_000,
  posDiscountSpvThresholdPercent: 10,
  voidWindowMinutes: 30,
  cashVarianceAutoApprove: 10_000,
  cashVarianceSpvReview: 50_000,

  // Loyalty program
  memberAnnualSpendWindowDays: 365,
  loyaltySilverThreshold: 500_000,
  loyaltyGoldThreshold: 2_000_000,
  loyaltyBronzeMultiplier: 1,
  loyaltySilverMultiplier: 1.2,
  loyaltyGoldMultiplier: 1.5,
  loyaltyPointsPerRupiah: 1,
  loyaltyRupiahPerPointRedeemed: 100,

  // Inventory & warehouse
  stockUnitTolerance: 5,
  stockPercentTolerance: 5,
  inventoryEscalationUnits: 10,
  expiryWarningDays: 30,

  // Operations / pacing
  businessHourStart: 9,
  businessHourEnd: 21,
  pacingRedThresholdPercent: 70,
  pacingYellowThresholdPercent: 90,

  // Paket Hemat (Potongan Penjualan)
  paketHematKopdesDiscount: 3_000,
  paketHematMbgDiscount: 5_000,
};

export type BusinessSettings = typeof DEFAULT_BUSINESS_SETTINGS;
