import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { dailyReportSubmitSchema } from "@/lib/validations/reports";
import { classifyVariance } from "@/lib/reconciliation";
import { computeDailyPreview } from "@/lib/reports";
import { computeStockPreview } from "@/lib/daily-report-stock";
import { DAILY_REPORT_STOCK_ITEMS } from "@/lib/daily-report-stock-items";
import { getSessionDate, getSessionTimeRange, getTimeRangeForDate, startOfToday } from "@/lib/session";
import { getBusinessSettings } from "@/lib/business-settings";
import { resolveEditableReportDate } from "@/lib/report-edit";

export async function POST(request: Request) {
  const { user, response } = await requirePermission("report:submit_daily");
  if (!user || !user.outletId) return response!;

  const parsed = dailyReportSubmitSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // The report is filed against the shift session's anchor date (check-in
  // date), not the calendar day of submission — closing out past midnight
  // still reports against the session that started the day before. `date`
  // overrides this only when it names one of this pramuniaga's own
  // PENDING/REJECTED reports (a resubmit-after-correction), in which case
  // the time window is that date's own attendance span rather than "today".
  const editDate = await resolveEditableReportDate(user.outletId, user.id, parsed.data.date ?? null);
  const sessionDate = editDate ?? (await getSessionDate(user.id));
  const timeRange = editDate
    ? await getTimeRangeForDate(user.id, editDate)
    : ((await getSessionTimeRange(user.id)) ?? { from: startOfToday(), to: new Date() });

  const existing = await prisma.dailyReport.findUnique({
    where: { outletId_pramuniagaId_date: { outletId: user.outletId, pramuniagaId: user.id, date: sessionDate } },
  });
  // Only a final APPROVED report is locked — PENDING (still awaiting SPV,
  // correctable before they decide) and REJECTED/REVISION (sent back) can
  // both be resubmitted. Previously this only allowed "REVISION", but SPV's
  // Reject button actually sets REJECTED, so a rejected report could never
  // be resubmitted at all — the bug being fixed here.
  if (existing && existing.status === "APPROVED") {
    return NextResponse.json({ error: "Laporan untuk sesi ini sudah diverifikasi dan tidak dapat diubah" }, { status: 409 });
  }

  const { omset, nonTunai, potongan, expenses, summarySetoran } = await computeDailyPreview(
    user.outletId,
    user.id,
    { ...timeRange, sessionDate },
  );
  const variance = parsed.data.actualCashCounted - summarySetoran;
  const settings = await getBusinessSettings();
  const varianceStatus = classifyVariance(variance, settings);

  // terjualSistem (and the item's productId/toppingId/price) is always
  // recomputed here from the actual POS sales for this shift. Ambil/Sisa
  // and material qtyUsed come from their persisted drafts — shared with the
  // Summary Setoran Outlet page's mirrored stock table and material tables
  // — rather than trusting whatever the submitting client's local form
  // state happened to have; whichever page was last edited is what gets
  // submitted.
  const [stockPreview, draftRows, materialDraftRows] = await Promise.all([
    computeStockPreview(user.outletId, user.id, timeRange),
    prisma.dailyReportStockDraft.findMany({ where: { outletId: user.outletId, pramuniagaId: user.id, date: sessionDate } }),
    prisma.dailyReportMaterialDraft.findMany({ where: { outletId: user.outletId, pramuniagaId: user.id, date: sessionDate } }),
  ]);
  const ambilSisaByIndex = new Map(draftRows.map((d) => [d.itemIndex, d]));
  const stockLinesToCreate = DAILY_REPORT_STOCK_ITEMS.map((spec, index) => {
    const preview = stockPreview[index];
    const manual = ambilSisaByIndex.get(index);
    return {
      productId: preview.productId,
      toppingId: preview.toppingId,
      itemName: spec.kind === "PRODUCT" ? spec.productName : spec.displayName,
      unitPrice: preview.unitPrice,
      ambil: manual?.ambil ?? 0,
      sisa: manual?.sisa ?? 0,
      terjualSistem: preview.terjualSistem,
      sortOrder: index,
    };
  });

  const materialLinesToCreate = materialDraftRows
    .filter((d) => Number(d.qtyUsed) > 0)
    .map((d) => ({ rawMaterialId: d.rawMaterialId, qtyUsed: d.qtyUsed }));

  const now = new Date();

  const report = await prisma.$transaction(async (tx) => {
    const r = await tx.dailyReport.upsert({
      where: { outletId_pramuniagaId_date: { outletId: user.outletId!, pramuniagaId: user.id, date: sessionDate } },
      create: {
        outletId: user.outletId!,
        pramuniagaId: user.id,
        date: sessionDate,
        omset,
        nonTunai,
        potongan,
        expenses,
        summarySetoran,
        actualCashCounted: parsed.data.actualCashCounted,
        variance,
        varianceStatus,
        notes: parsed.data.notes,
        // Verification is SPV's call, never automatic — every submission
        // (even a perfectly reconciled one) starts PENDING and only becomes
        // APPROVED through the SPV validate action.
        status: "PENDING",
      },
      update: {
        omset,
        nonTunai,
        potongan,
        expenses,
        summarySetoran,
        actualCashCounted: parsed.data.actualCashCounted,
        variance,
        varianceStatus,
        notes: parsed.data.notes,
        status: "PENDING",
        submittedAt: now,
      },
    });

    // Resubmission (status was REVISION) replaces the stock/material lines
    // wholesale rather than merging — the whole shift's counts are re-entered.
    await tx.dailyReportStockLine.deleteMany({ where: { dailyReportId: r.id } });
    await tx.dailyReportMaterialLine.deleteMany({ where: { dailyReportId: r.id } });
    await tx.dailyReportStockLine.createMany({
      data: stockLinesToCreate.map((l) => ({ ...l, dailyReportId: r.id })),
    });
    if (materialLinesToCreate.length > 0) {
      await tx.dailyReportMaterialLine.createMany({
        data: materialLinesToCreate.map((l) => ({ ...l, dailyReportId: r.id })),
      });
    }

    // Submitting the report closes out the day — anyone still checked in
    // under this login for this session date gets automatically checked out
    // rather than being left open indefinitely.
    const openRecords = await tx.attendanceRecord.findMany({
      where: { userId: user.id, date: sessionDate, timeOut: null },
    });
    for (const rec of openRecords) {
      await tx.attendanceRecord.update({
        where: { id: rec.id },
        data: {
          timeOut: now,
          totalHours: rec.timeIn ? (now.getTime() - rec.timeIn.getTime()) / 1000 / 60 / 60 : null,
        },
      });
    }

    return r;
  });

  return NextResponse.json({ report_id: report.id, success: true, status: report.status });
}
