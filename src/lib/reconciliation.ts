import type { VarianceStatus } from "@prisma/client";
import type { BusinessSettings } from "@/lib/business-settings-defaults";

// Thresholds per prd.md §4.1 "Variance Detection", admin-editable at
// /admin/settings — see DEFAULT_BUSINESS_SETTINGS for the fallback values.
export function classifyVariance(
  variance: number,
  settings: Pick<BusinessSettings, "cashVarianceAutoApprove" | "cashVarianceSpvReview">,
): VarianceStatus {
  const abs = Math.abs(variance);
  if (abs <= settings.cashVarianceAutoApprove) return "RECONCILED";
  if (abs <= settings.cashVarianceSpvReview) return "SPV_REVIEW";
  return "ESCALATED";
}
