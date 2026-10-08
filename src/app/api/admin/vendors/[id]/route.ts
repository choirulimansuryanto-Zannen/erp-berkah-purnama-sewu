import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { updateVendorSchema } from "@/lib/validations/vendor";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, response } = await requirePermission("admin:system_config");
  if (!user) return response!;

  const parsed = updateVendorSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const vendor = await prisma.vendor.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ success: true, vendor });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, response } = await requirePermission("admin:system_config");
  if (!user) return response!;

  // Soft-delete via status, same as every other master-data list here —
  // keeps its ledger entries (and their FK) intact for history.
  await prisma.vendor.update({ where: { id }, data: { status: "INACTIVE" } });
  return NextResponse.json({ success: true });
}
