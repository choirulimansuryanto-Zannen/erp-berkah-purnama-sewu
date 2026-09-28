import type { MemberTier } from "@prisma/client";
import type { BusinessSettings } from "@/lib/business-settings-defaults";

// Values per prd.md §6.1-6.2, admin-editable at /admin/settings — see
// DEFAULT_BUSINESS_SETTINGS in business-settings.ts for the fallback values.
// NOTE: the 1-point-per-Rp1-spent earn rate next to a 100-points=Rp10,000
// redemption rate (i.e. 1 point = Rp100 redemption value) looks like a
// mismatch in the source PRD — flagged for confirmation, implemented
// literally as written (now correctable via the admin UI without a code
// change).

export function tierForAnnualSpend(
  annualSpend: number,
  settings: Pick<BusinessSettings, "loyaltySilverThreshold" | "loyaltyGoldThreshold">,
): MemberTier {
  if (annualSpend > settings.loyaltyGoldThreshold) return "GOLD";
  if (annualSpend > settings.loyaltySilverThreshold) return "SILVER";
  return "BRONZE";
}

export function calculatePointsEarned(
  total: number,
  tier: MemberTier,
  settings: Pick<
    BusinessSettings,
    "loyaltyPointsPerRupiah" | "loyaltyBronzeMultiplier" | "loyaltySilverMultiplier" | "loyaltyGoldMultiplier"
  >,
): number {
  const multiplier = {
    BRONZE: settings.loyaltyBronzeMultiplier,
    SILVER: settings.loyaltySilverMultiplier,
    GOLD: settings.loyaltyGoldMultiplier,
  }[tier];
  return Math.floor(total * settings.loyaltyPointsPerRupiah * multiplier);
}

export function redemptionValue(points: number, settings: Pick<BusinessSettings, "loyaltyRupiahPerPointRedeemed">): number {
  return points * settings.loyaltyRupiahPerPointRedeemed;
}
