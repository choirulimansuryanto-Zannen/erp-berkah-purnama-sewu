import { z } from "zod";

const CATEGORIES = ["ALACARTE", "PAKET_ONLINE", "PAKET_MBG", "PAKET_KOPDES", "PAKET_PAHLAWAN"] as const;
const CHANNELS = ["CASH", "CASHLESS", "GRAB", "GOFOOD", "SHOPEE", "QPON", "TIKTOK"] as const;

export const channelRulesSchema = z.object({
  rules: z.array(
    z.object({
      category: z.enum(CATEGORIES),
      // Empty array = no restriction, same as no row at all.
      allowedChannels: z.array(z.enum(CHANNELS)),
    }),
  ),
});
