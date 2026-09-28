import "server-only";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Returns the outlet IDs a user is allowed to see aggregated data for.
 * `null` means "no restriction" (company-wide — OFFICE, FA_ADMIN, MASTER_ADMIN).
 * SPV is restricted to the outlets in the region(s) they are assigned as spvId.
 */
export async function getScopedOutletIds(userId: string, role: Role): Promise<string[] | null> {
  if (role !== "SPV") return null;

  const regions = await prisma.region.findMany({
    where: { spvId: userId },
    select: { outlets: { select: { id: true } } },
  });

  return regions.flatMap((r) => r.outlets.map((o) => o.id));
}

/** True if the user may act on data belonging to outletId (company-wide roles always pass). */
export async function isOutletInScope(userId: string, role: Role, outletId: string): Promise<boolean> {
  const scoped = await getScopedOutletIds(userId, role);
  return scoped === null || scoped.includes(outletId);
}
