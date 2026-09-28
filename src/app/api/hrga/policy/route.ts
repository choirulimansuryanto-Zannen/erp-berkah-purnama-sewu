import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { attendancePolicySchema } from "@/lib/validations/policy";
import { DEFAULT_ATTENDANCE_POLICY } from "@/lib/policy";

export async function GET() {
  const { user, response } = await requirePermission("hrga:manage_policy");
  if (!user) return response!;

  const policy = await prisma.attendancePolicy.findFirst();
  return NextResponse.json({ policy: policy ?? DEFAULT_ATTENDANCE_POLICY });
}

export async function PUT(request: Request) {
  const { user, response } = await requirePermission("hrga:manage_policy");
  if (!user) return response!;

  const parsed = attendancePolicySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  if (parsed.data.checkpointEndHour <= parsed.data.checkpointStartHour) {
    return NextResponse.json({ error: "checkpointEndHour must be after checkpointStartHour" }, { status: 400 });
  }

  const existing = await prisma.attendancePolicy.findFirst();
  const policy = existing
    ? await prisma.attendancePolicy.update({
        where: { id: existing.id },
        data: { ...parsed.data, updatedById: user.id },
      })
    : await prisma.attendancePolicy.create({ data: { ...parsed.data, updatedById: user.id } });

  return NextResponse.json({ success: true, policy });
}
