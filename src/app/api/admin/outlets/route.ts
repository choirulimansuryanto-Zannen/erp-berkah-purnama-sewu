import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";

const createOutletSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  regionId: z.string().uuid(),
  dailyTarget: z.number().min(0).default(0),
  weeklyTarget: z.number().min(0).default(0),
  monthlyTarget: z.number().min(0).default(0),
  insentifTarget: z.number().min(0).default(0),
  fullshiftTarget: z.number().min(0).default(0),
});

export async function GET() {
  const { user, response } = await requirePermission("admin:system_config");
  if (!user) return response!;

  const outlets = await prisma.outlet.findMany({ include: { region: true }, orderBy: { name: "asc" } });
  return NextResponse.json({ outlets });
}

export async function POST(request: Request) {
  const { user, response } = await requirePermission("admin:system_config");
  if (!user) return response!;

  const parsed = createOutletSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const outlet = await prisma.outlet.create({ data: parsed.data });
  return NextResponse.json({ success: true, outlet_id: outlet.id });
}
