import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { isOutletInScope } from "@/lib/outlet-scope";

const decisionSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, response } = await requirePermission("attendance:approve_leave");
  if (!user) return response!;

  const parsed = decisionSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.leavePermission.findUnique({
    where: { id },
    select: { user: { select: { outletId: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
  if (existing.user.outletId && !(await isOutletInScope(user.id, user.role, existing.user.outletId))) {
    return NextResponse.json({ error: "Outlet is outside your region" }, { status: 403 });
  }

  const leave = await prisma.leavePermission.update({
    where: { id },
    data: { status: parsed.data.status, approvedById: user.id, approvedAt: new Date() },
  });

  return NextResponse.json({ success: true, status: leave.status });
}
