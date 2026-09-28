import { calculatePointsEarned, redemptionValue, tierForAnnualSpend } from "@/lib/loyalty";
import { DEFAULT_BUSINESS_SETTINGS } from "@/lib/business-settings-defaults";

describe("tierForAnnualSpend", () => {
  it("returns BRONZE at or below the silver threshold", () => {
    expect(tierForAnnualSpend(0, DEFAULT_BUSINESS_SETTINGS)).toBe("BRONZE");
    expect(tierForAnnualSpend(500_000, DEFAULT_BUSINESS_SETTINGS)).toBe("BRONZE");
  });

  it("returns SILVER above the silver threshold and at or below gold", () => {
    expect(tierForAnnualSpend(500_001, DEFAULT_BUSINESS_SETTINGS)).toBe("SILVER");
    expect(tierForAnnualSpend(2_000_000, DEFAULT_BUSINESS_SETTINGS)).toBe("SILVER");
  });

  it("returns GOLD above the gold threshold", () => {
    expect(tierForAnnualSpend(2_000_001, DEFAULT_BUSINESS_SETTINGS)).toBe("GOLD");
  });

  it("adapts to a custom threshold", () => {
    expect(tierForAnnualSpend(100, { loyaltySilverThreshold: 50, loyaltyGoldThreshold: 200 })).toBe("SILVER");
  });
});

describe("calculatePointsEarned", () => {
  it("applies the tier multiplier and floors the result", () => {
    expect(calculatePointsEarned(100, "BRONZE", DEFAULT_BUSINESS_SETTINGS)).toBe(100);
    expect(calculatePointsEarned(100, "SILVER", DEFAULT_BUSINESS_SETTINGS)).toBe(120);
    expect(calculatePointsEarned(101, "SILVER", DEFAULT_BUSINESS_SETTINGS)).toBe(121); // floor(121.2)
    expect(calculatePointsEarned(100, "GOLD", DEFAULT_BUSINESS_SETTINGS)).toBe(150);
  });
});

describe("redemptionValue", () => {
  it("matches the 100 points = Rp 10,000 rule from prd.md", () => {
    expect(redemptionValue(100, DEFAULT_BUSINESS_SETTINGS)).toBe(10_000);
  });
});
