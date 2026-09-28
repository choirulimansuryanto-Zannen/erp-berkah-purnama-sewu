// Pure — no imports — so it's unit-testable without pulling in Prisma. A
// category with no rule row (or an empty allowedChannels list) has no
// restriction; only categories that actually have a rule are constrained.
export type ChannelRule = { category: string; allowedChannels: string[] };

export function isChannelAllowedForCategory(category: string, channel: string, rules: ChannelRule[]): boolean {
  const rule = rules.find((r) => r.category === category);
  if (!rule || rule.allowedChannels.length === 0) return true;
  return rule.allowedChannels.includes(channel);
}
