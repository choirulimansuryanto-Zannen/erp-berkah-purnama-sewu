import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { DEFAULT_BUSINESS_SETTINGS, type BusinessSettings } from "@/lib/business-settings-defaults";

export { DEFAULT_BUSINESS_SETTINGS, type BusinessSettings };

const NUMERIC_FIELDS = Object.keys(DEFAULT_BUSINESS_SETTINGS) as (keyof BusinessSettings)[];

export const getBusinessSettings = cache(async (): Promise<BusinessSettings> => {
  const row = await prisma.businessSettings.findFirst();
  if (!row) return DEFAULT_BUSINESS_SETTINGS;

  const settings = { ...DEFAULT_BUSINESS_SETTINGS };
  for (const field of NUMERIC_FIELDS) {
    settings[field] = Number(row[field]);
  }
  return settings;
});
