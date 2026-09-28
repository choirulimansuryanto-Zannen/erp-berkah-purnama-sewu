import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";

// Lightweight name list for the "who's approving this void/edit" picker —
// gated to the same permission as initiating a void, not admin:manage_users,
// since a pramuniaga requesting a void needs to see this list too.
export async function GET() {
  const { user, response } = await requirePermission("pos:void_transaction");
  if (!user) return response!;

  const approvers = await prisma.user.findMany({
    where: { role: { in: ["SPV", "MASTER_ADMIN"] }, status: "ACTIVE" },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ approvers });
}
