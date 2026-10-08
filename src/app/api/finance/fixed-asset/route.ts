import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { createFixedAssetSchema } from "@/lib/validations/fixed-asset";

export async function POST(request: Request) {
  const { user, response } = await requirePermission("finance:manage_journal");
  if (!user) return response!;

  const parsed = createFixedAssetSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { category, description, acquisitionAmount, depreciableBase, usefulLifeMonths, acquisitionDate, remark } = parsed.data;

  const count = await prisma.fixedAsset.count({ where: { category } });
  const asset = await prisma.fixedAsset.create({
    data: {
      no: count + 1,
      category,
      description,
      acquisitionAmount,
      depreciableBase,
      usefulLifeMonths,
      acquisitionDate: new Date(`${acquisitionDate}T00:00:00.000Z`),
      remark,
      status: "ACTIVE",
    },
  });
  return NextResponse.json({ success: true, id: asset.id });
}
