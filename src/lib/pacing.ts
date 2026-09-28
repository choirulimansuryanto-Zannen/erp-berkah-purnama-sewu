import type { BusinessSettings } from "@/lib/business-settings-defaults";

// Outlet performance alert thresholds per prd.md §2.7 "OUTLET PERFORMANCE
// DASHBOARD", admin-editable at /admin/settings — see
// DEFAULT_BUSINESS_SETTINGS for the fallback values. Business hours
// (09:00-21:00 by default) were an assumption — prd.md defines checkpoints
// from 09:00-20:00 but doesn't state closing time explicitly.

export type PaceTone = "red" | "yellow" | "green";

export function elapsedBusinessFraction(
  now: Date,
  settings: Pick<BusinessSettings, "businessHourStart" | "businessHourEnd">,
): number {
  const hours = now.getHours() + now.getMinutes() / 60;
  const span = settings.businessHourEnd - settings.businessHourStart;
  return Math.min(1, Math.max(0, (hours - settings.businessHourStart) / span));
}

export function classifyPace(
  actual: number,
  target: number,
  elapsedFraction: number,
  settings: Pick<BusinessSettings, "pacingRedThresholdPercent" | "pacingYellowThresholdPercent">,
): PaceTone {
  const expected = target * elapsedFraction;
  if (expected <= 0) return "green";
  const pct = (actual / expected) * 100;
  if (pct < settings.pacingRedThresholdPercent) return "red";
  if (pct <= settings.pacingYellowThresholdPercent) return "yellow";
  return "green";
}
