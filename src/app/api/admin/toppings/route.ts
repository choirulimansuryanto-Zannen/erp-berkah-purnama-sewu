import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { createToppingSchema } from "@/lib/validations/toppings";

export async function GET() {
  const toppings = await prisma.topping.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ toppings });
}

export async function POST(request: Request) {
  const { user, response } = await requirePermission("admin:system_config");
  if (!user) return response!;

  const parsed = createToppingSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const topping = await prisma.topping.create({ data: parsed.data });
  return NextResponse.json({ topping_id: topping.id, success: true });
}
