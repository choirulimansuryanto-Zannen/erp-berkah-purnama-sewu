import { classifyVariance } from "@/lib/reconciliation";
import { DEFAULT_BUSINESS_SETTINGS } from "@/lib/business-settings-defaults";

describe("classifyVariance", () => {
  it("auto-reconciles variance within Rp 10,000", () => {
    expect(classifyVariance(0, DEFAULT_BUSINESS_SETTINGS)).toBe("RECONCILED");
    expect(classifyVariance(10_000, DEFAULT_BUSINESS_SETTINGS)).toBe("RECONCILED");
    expect(classifyVariance(-10_000, DEFAULT_BUSINESS_SETTINGS)).toBe("RECONCILED");
  });

  it("requires SPV review between Rp 10,001 and Rp 50,000", () => {
    expect(classifyVariance(10_001, DEFAULT_BUSINESS_SETTINGS)).toBe("SPV_REVIEW");
    expect(classifyVariance(50_000, DEFAULT_BUSINESS_SETTINGS)).toBe("SPV_REVIEW");
    expect(classifyVariance(-50_000, DEFAULT_BUSINESS_SETTINGS)).toBe("SPV_REVIEW");
  });

  it("escalates variance beyond Rp 50,000", () => {
    expect(classifyVariance(50_001, DEFAULT_BUSINESS_SETTINGS)).toBe("ESCALATED");
    expect(classifyVariance(-1_000_000, DEFAULT_BUSINESS_SETTINGS)).toBe("ESCALATED");
  });

  it("adapts to a custom threshold", () => {
    expect(classifyVariance(100, { cashVarianceAutoApprove: 50, cashVarianceSpvReview: 200 })).toBe("SPV_REVIEW");
  });
});
