import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { createVendorSchema } from "@/lib/validations/vendor";

export async function GET() {
  const vendors = await prisma.vendor.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ vendors });
}

export async function POST(request: Request) {
  const { user, response } = await requirePermission("admin:system_config");
  if (!user) return response!;

  const parsed = createVendorSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const count = await prisma.vendor.count();
  const vendor = await prisma.vendor.create({ data: { ...parsed.data, sortOrder: count } });
  return NextResponse.json({ vendor_id: vendor.id, success: true });
}
