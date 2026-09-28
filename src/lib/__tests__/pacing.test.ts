import { classifyPace, elapsedBusinessFraction } from "@/lib/pacing";
import { DEFAULT_BUSINESS_SETTINGS } from "@/lib/business-settings-defaults";

describe("elapsedBusinessFraction", () => {
  it("clamps to 0 before business hours start", () => {
    expect(elapsedBusinessFraction(new Date(2026, 0, 1, 7, 0), DEFAULT_BUSINESS_SETTINGS)).toBe(0);
  });

  it("clamps to 1 after business hours end", () => {
    expect(elapsedBusinessFraction(new Date(2026, 0, 1, 22, 0), DEFAULT_BUSINESS_SETTINGS)).toBe(1);
  });

  it("returns 0.5 at the midpoint of business hours (09:00-21:00)", () => {
    expect(elapsedBusinessFraction(new Date(2026, 0, 1, 15, 0), DEFAULT_BUSINESS_SETTINGS)).toBe(0.5);
  });
});

describe("classifyPace", () => {
  it("returns green when there is no meaningful target yet", () => {
    expect(classifyPace(0, 1_000_000, 0, DEFAULT_BUSINESS_SETTINGS)).toBe("green");
  });

  it("classifies red when actual is well below the expected pace", () => {
    // elapsed 0.5 of a 1,000,000 target => expected 500,000
    expect(classifyPace(300_000, 1_000_000, 0.5, DEFAULT_BUSINESS_SETTINGS)).toBe("red");
  });

  it("classifies yellow in the 70-90% band", () => {
    expect(classifyPace(400_000, 1_000_000, 0.5, DEFAULT_BUSINESS_SETTINGS)).toBe("yellow");
  });

  it("classifies green above 90% of expected pace", () => {
    expect(classifyPace(500_000, 1_000_000, 0.5, DEFAULT_BUSINESS_SETTINGS)).toBe("green");
  });
});
