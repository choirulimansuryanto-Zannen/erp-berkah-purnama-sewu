import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { leaveRequestSchema } from "@/lib/validations/attendance";

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (!user) return response!;

  const parsed = leaveRequestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const leave = await prisma.leavePermission.create({
    data: { userId: user.id, ...parsed.data },
  });

  return NextResponse.json({ success: true, id: leave.id, status: leave.status });
}
