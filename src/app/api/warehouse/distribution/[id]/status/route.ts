import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { distributionStatusSchema } from "@/lib/validations/warehouse";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, response } = await requirePermission("warehouse:manage");
  if (!user) return response!;

  const parsed = distributionStatusSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const distribution = await prisma.stockDistribution.update({
    where: { id },
    data: {
      status: parsed.data.status,
      ...(parsed.data.status === "IN_TRANSIT" ? { dispatchedById: user.id } : {}),
      ...(parsed.data.status === "DELIVERED" ? { deliveredAt: new Date() } : {}),
    },
  });

  return NextResponse.json({ success: true, status: distribution.status });
}
