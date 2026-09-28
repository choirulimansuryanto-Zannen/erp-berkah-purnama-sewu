import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { materialDraftSchema } from "@/lib/validations/reports";
import { getSessionDate } from "@/lib/session";
import { resolveEditableReportDate } from "@/lib/report-edit";

// One material's qtyUsed, saved on blur — lives on Summary Setoran Outlet
// now, but Daily Report's Submit Laporan still reads from here at submit
// time (see DailyReportMaterialDraft).
export async function POST(request: Request) {
  const { user, response } = await requirePermission("report:submit_daily");
  if (!user || !user.outletId) return response!;

  const parsed = materialDraftSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const sessionDate =
    (await resolveEditableReportDate(user.outletId, user.id, parsed.data.date ?? null)) ?? (await getSessionDate(user.id));

  await prisma.dailyReportMaterialDraft.upsert({
    where: {
      outletId_pramuniagaId_date_rawMaterialId: {
        outletId: user.outletId,
        pramuniagaId: user.id,
        date: sessionDate,
        rawMaterialId: parsed.data.rawMaterialId,
      },
    },
    create: {
      outletId: user.outletId,
      pramuniagaId: user.id,
      date: sessionDate,
      rawMaterialId: parsed.data.rawMaterialId,
      qtyUsed: parsed.data.qtyUsed,
    },
    update: { qtyUsed: parsed.data.qtyUsed },
  });

  return NextResponse.json({ success: true });
}
