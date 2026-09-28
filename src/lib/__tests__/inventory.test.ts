import { isWithinTolerance } from "@/lib/inventory";
import { DEFAULT_BUSINESS_SETTINGS } from "@/lib/business-settings-defaults";

describe("isWithinTolerance", () => {
  it("tolerates variance within ±5 units regardless of system balance", () => {
    expect(isWithinTolerance(5, 10, DEFAULT_BUSINESS_SETTINGS)).toBe(true);
    expect(isWithinTolerance(-5, 10, DEFAULT_BUSINESS_SETTINGS)).toBe(true);
  });

  it("tolerates variance within ±5% of a large system balance", () => {
    expect(isWithinTolerance(50, 1000, DEFAULT_BUSINESS_SETTINGS)).toBe(true); // 5% of 1000
    expect(isWithinTolerance(-50, 1000, DEFAULT_BUSINESS_SETTINGS)).toBe(true);
  });

  it("flags variance beyond both the unit and percent tolerance", () => {
    expect(isWithinTolerance(51, 100, DEFAULT_BUSINESS_SETTINGS)).toBe(false); // >5 units and >5% of 100
    expect(isWithinTolerance(6, 10, DEFAULT_BUSINESS_SETTINGS)).toBe(false);
  });

  it("adapts to a custom tolerance", () => {
    expect(isWithinTolerance(2, 1000, { stockUnitTolerance: 1, stockPercentTolerance: 1 })).toBe(true);
  });
});
