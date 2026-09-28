import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { createFreezerMaterialSchema } from "@/lib/validations/freezer-materials";

export async function POST(request: Request) {
  const { user, response } = await requirePermission("admin:system_config");
  if (!user) return response!;

  const parsed = createFreezerMaterialSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const entry = await prisma.freezerMaterial.create({ data: parsed.data });
  return NextResponse.json({ freezer_material_id: entry.id, success: true });
}
