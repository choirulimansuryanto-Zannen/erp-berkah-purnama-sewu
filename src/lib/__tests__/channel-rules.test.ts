import { isChannelAllowedForCategory, type ChannelRule } from "@/lib/channel-rules";

const RULES: ChannelRule[] = [
  { category: "PAKET_ONLINE", allowedChannels: ["GRAB", "GOFOOD", "SHOPEE"] },
  { category: "PAKET_KOPDES", allowedChannels: ["CASH", "CASHLESS", "QPON", "TIKTOK"] },
  { category: "PAKET_PAHLAWAN", allowedChannels: ["GRAB", "GOFOOD", "SHOPEE"] },
];

describe("isChannelAllowedForCategory", () => {
  it("allows PAKET_ONLINE only on the online channels", () => {
    expect(isChannelAllowedForCategory("PAKET_ONLINE", "GRAB", RULES)).toBe(true);
    expect(isChannelAllowedForCategory("PAKET_ONLINE", "CASH", RULES)).toBe(false);
  });

  it("blocks PAKET_KOPDES from the online channels but allows offline ones", () => {
    expect(isChannelAllowedForCategory("PAKET_KOPDES", "GRAB", RULES)).toBe(false);
    expect(isChannelAllowedForCategory("PAKET_KOPDES", "CASH", RULES)).toBe(true);
  });

  it("has no restriction for a category with no rule row", () => {
    expect(isChannelAllowedForCategory("ALACARTE", "CASH", RULES)).toBe(true);
    expect(isChannelAllowedForCategory("PAKET_MBG", "GRAB", RULES)).toBe(true);
  });

  it("treats an empty allowedChannels list as unrestricted", () => {
    const rules: ChannelRule[] = [{ category: "PAKET_ONLINE", allowedChannels: [] }];
    expect(isChannelAllowedForCategory("PAKET_ONLINE", "CASH", rules)).toBe(true);
  });
});
