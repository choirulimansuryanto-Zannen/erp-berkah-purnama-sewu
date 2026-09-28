import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";

const updateProfileSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
});

export async function PUT(request: Request) {
  const { user, response } = await requireUser();
  if (!user) return response!;

  const parsed = updateProfileSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.user.update({ where: { id: user.id }, data: parsed.data });
  return NextResponse.json({ success: true, name: updated.name, phone: updated.phone });
}
