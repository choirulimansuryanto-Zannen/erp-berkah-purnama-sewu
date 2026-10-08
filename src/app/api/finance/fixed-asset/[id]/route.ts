import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { updateFixedAssetSchema } from "@/lib/validations/fixed-asset";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, response } = await requirePermission("finance:manage_journal");
  if (!user) return response!;

  const parsed = updateFixedAssetSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const asset = await prisma.fixedAsset.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ success: true, asset });
}
