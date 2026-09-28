import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { stockDraftSchema } from "@/lib/validations/reports";
import { getSessionDate } from "@/lib/session";
import { resolveEditableReportDate } from "@/lib/report-edit";

// One field's Ambil/Sisa, saved on blur — shared between the Daily Report
// page and Summary Setoran Outlet's mirrored stock table, so either one
// reflects what was last entered on the other.
export async function POST(request: Request) {
  const { user, response } = await requirePermission("report:submit_daily");
  if (!user || !user.outletId) return response!;

  const parsed = stockDraftSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // `date` is only honored when it names one of this pramuniaga's own
  // PENDING/REJECTED reports — otherwise silently falls back to the live
  // session date, same as if no override had been sent at all.
  const sessionDate =
    (await resolveEditableReportDate(user.outletId, user.id, parsed.data.date ?? null)) ?? (await getSessionDate(user.id));

  await prisma.dailyReportStockDraft.upsert({
    where: {
      outletId_pramuniagaId_date_itemIndex: {
        outletId: user.outletId,
        pramuniagaId: user.id,
        date: sessionDate,
        itemIndex: parsed.data.itemIndex,
      },
    },
    create: {
      outletId: user.outletId,
      pramuniagaId: user.id,
      date: sessionDate,
      itemIndex: parsed.data.itemIndex,
      ambil: parsed.data.ambil,
      sisa: parsed.data.sisa,
    },
    update: { ambil: parsed.data.ambil, sisa: parsed.data.sisa },
  });

  return NextResponse.json({ success: true });
}
