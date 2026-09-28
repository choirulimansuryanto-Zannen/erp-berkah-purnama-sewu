import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { checkpointSchema } from "@/lib/validations/attendance";

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (!user) return response!;

  if (!user.outletId) {
    return NextResponse.json({ error: "User has no outlet assigned" }, { status: 400 });
  }

  const parsed = checkpointSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const checkpoint = await prisma.attendanceCheckpoint.create({
    data: {
      userId: user.id,
      outletId: user.outletId,
      ...parsed.data,
    },
  });

  return NextResponse.json({ success: true, timestamp: checkpoint.timestamp });
}
