import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";

const updateOutletSchema = z.object({
  dailyTarget: z.number().min(0).optional(),
  weeklyTarget: z.number().min(0).optional(),
  monthlyTarget: z.number().min(0).optional(),
  insentifTarget: z.number().min(0).optional(),
  fullshiftTarget: z.number().min(0).optional(),
  maxPramuniagaPerShift: z.number().int().min(1).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, response } = await requirePermission("admin:system_config");
  if (!user) return response!;

  const parsed = updateOutletSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const outlet = await prisma.outlet.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ success: true, outlet });
}
