import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";

const createProductSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(["ALACARTE", "PAKET_ONLINE", "PAKET_MBG", "PAKET_KOPDES", "PAKET_PAHLAWAN"]),
  price: z.number().positive(),
  cost: z.number().min(0),
});

export async function GET() {
  const products = await prisma.product.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }] });
  return NextResponse.json({ products });
}

export async function POST(request: Request) {
  const { user, response } = await requirePermission("admin:system_config");
  if (!user) return response!;

  const parsed = createProductSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Append new products to the end of their category's menu order rather
  // than defaulting to sortOrder 0 (which would jump them to the front).
  const last = await prisma.product.findFirst({
    where: { category: parsed.data.category },
    orderBy: { sortOrder: "desc" },
  });

  const product = await prisma.product.create({ data: { ...parsed.data, sortOrder: (last?.sortOrder ?? 0) + 1 } });
  return NextResponse.json({ product_id: product.id, success: true });
}
