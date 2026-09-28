import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";

const createRegionSchema = z.object({
  name: z.string().min(1),
  spvId: z.string().uuid().optional(),
});

export async function GET() {
  const { user, response } = await requirePermission("admin:system_config");
  if (!user) return response!;

  const regions = await prisma.region.findMany({ include: { outlets: true }, orderBy: { name: "asc" } });
  return NextResponse.json({ regions });
}

export async function POST(request: Request) {
  const { user, response } = await requirePermission("admin:system_config");
  if (!user) return response!;

  const parsed = createRegionSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const region = await prisma.region.create({ data: parsed.data });
  return NextResponse.json({ success: true, region_id: region.id });
}
