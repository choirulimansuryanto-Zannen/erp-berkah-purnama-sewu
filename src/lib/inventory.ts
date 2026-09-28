import type { BusinessSettings } from "@/lib/business-settings-defaults";

// Tolerance per prd.md §3.1: ±5% or ±5 units, admin-editable at
// /admin/settings — see DEFAULT_BUSINESS_SETTINGS for the fallback values.
export function isWithinTolerance(
  variance: number,
  systemBalance: number,
  settings: Pick<BusinessSettings, "stockUnitTolerance" | "stockPercentTolerance">,
): boolean {
  const abs = Math.abs(variance);
  return abs <= settings.stockUnitTolerance || abs <= systemBalance * (settings.stockPercentTolerance / 100);
}
