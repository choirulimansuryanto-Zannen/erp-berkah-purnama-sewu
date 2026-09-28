import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { reportValidationSchema } from "@/lib/validations/reports";
import { isOutletInScope } from "@/lib/outlet-scope";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, response } = await requirePermission("report:validate");
  if (!user) return response!;

  const parsed = reportValidationSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.dailyReport.findUnique({ where: { id }, select: { outletId: true } });
  if (!existing) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  if (!(await isOutletInScope(user.id, user.role, existing.outletId))) {
    return NextResponse.json({ error: "Outlet is outside your region" }, { status: 403 });
  }

  const report = await prisma.dailyReport.update({
    where: { id },
    data: {
      status: parsed.data.status,
      spvNotes: parsed.data.notes,
      reviewedById: user.id,
      reviewedAt: new Date(),
    },
  });

  return NextResponse.json({ success: true, status_updated: report.status });
}
