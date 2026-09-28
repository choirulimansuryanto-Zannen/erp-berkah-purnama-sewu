import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBusinessSettings } from "@/lib/business-settings";
import { getSessionDate, getSessionTimeRange, getTimeRangeForDate, startOfToday } from "@/lib/session";
import { resolveEditableReportDate, parseDateOnlyParam } from "@/lib/report-edit";
import { computeStockPreview } from "@/lib/daily-report-stock";
import { getStockDraft } from "@/lib/daily-report-stock-draft";
import { getMaterialDraft } from "@/lib/daily-report-material-draft";
import { formatParticipantNames } from "@/lib/attendance-participants";
import { computeOnlineCashlessBreakdown, computePotonganPenjualan } from "@/lib/expenses-outlet";
import { SetoranOutletView } from "@/components/setoran/setoran-outlet-view";

function dateOnlyString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const SHIFT_LABELS: Record<string, string> = {
  SHIFT_1: "Shift 1",
  SHIFT_2: "Shift 2",
  FULLSHIFT: "Fullshift",
};

const dateLabelFormat = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" });
const fullDateLabelFormat = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export default async function SetoranPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; editDate?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== "PRAMUNIAGA" || !user.outletId) redirect("/dashboard");

  const { from, to, editDate: editDateParam } = await searchParams;
  const outletId = user.outletId;

  // Revising a past PENDING/REJECTED report: `editDate` swaps the whole
  // "Input Kasir" section (Table 1, drafts, manual entry, kasbon, expenses)
  // over to that date instead of the live session — but only when it truly
  // names one of this pramuniaga's own non-APPROVED reports, never an
  // arbitrary date.
  const editableDate = await resolveEditableReportDate(outletId, user.id, parseDateOnlyParam(editDateParam));
  const sessionDate = editableDate ?? (await getSessionDate(user.id));
  const timeRange = editableDate
    ? await getTimeRangeForDate(user.id, editableDate)
    : ((await getSessionTimeRange(user.id)) ?? { from: startOfToday(), to: new Date() });
  const settings = await getBusinessSettings();

  // "Riwayat Pengeluaran Tercatat" and the Operasional Outlet rekap can be
  // browsed over any date range (defaults to today/the current session's
  // date) — the Input Kasir tables above them (Table 1, Online & Cashless,
  // Potongan, Kasbon) always stay anchored to the live session.
  const rangeFrom = from ? new Date(`${from}T00:00:00`) : new Date(sessionDate);
  rangeFrom.setUTCHours(0, 0, 0, 0);
  const rangeTo = to ? new Date(`${to}T00:00:00`) : new Date(rangeFrom);
  rangeTo.setUTCHours(23, 59, 59, 999);

  const [
    outlet,
    openSessions,
    reportAttendanceRecords,
    allCategories,
    savedManualEntry,
    promo,
    kasbonList,
    expenseHistory,
    categoryTotalsRaw,
    stockPreview,
    stockDraft,
    materials,
    materialDraft,
    sessionReport,
    reportHistory,
  ] = await Promise.all([
    prisma.outlet.findUnique({ where: { id: outletId }, include: { region: true } }),
    // Same "declared identity at check-in wins over the shared login name"
    // convention as POS's cashierName — a login can be used by whichever
    // roster member is actually on shift.
    prisma.attendanceRecord.findMany({
      where: { userId: user.id, timeOut: null },
      include: { pramuniagaRoster: true },
      orderBy: { timeIn: "asc" },
    }),
    // Informasi Outlet card: tied to the report's own date (sessionDate),
    // not just "whichever session happens to be open" — the two usually
    // coincide, but this is what "locked from Absen Masuk" should mean. Each
    // pramuniaga checks in independently, so a day can have several rows —
    // shown separately (own name + own shift), not merged into one field.
    prisma.attendanceRecord.findMany({
      where: { userId: user.id, date: sessionDate },
      include: { pramuniagaRoster: true },
      orderBy: { timeIn: "asc" },
    }),
    prisma.expenseCategoryDef.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.expenseManualEntry.findUnique({
      where: { outletId_pramuniagaId_date: { outletId, pramuniagaId: user.id, date: sessionDate } },
    }),
    prisma.promoDiscount.findUnique({ where: { outletId_pramuniagaId_date: { outletId, pramuniagaId: user.id, date: sessionDate } } }),
    // Scoped to today's session only — kasbon is a same-day, fill-in-fresh
    // entry, not a running history to browse. This also fixes the Total
    // Fisik Cash calc downstream, which previously subtracted an all-time
    // kasbon sum instead of just today's.
    prisma.kasbon.findMany({
      where: { outletId, pramuniagaId: user.id, date: sessionDate },
      include: { pramuniagaRoster: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.expenseRecord.findMany({
      where: { submittedById: user.id, outletId, date: { gte: rangeFrom, lte: rangeTo } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.expenseRecord.groupBy({
      by: ["category"],
      where: { submittedById: user.id, outletId, date: { gte: rangeFrom, lte: rangeTo } },
      _sum: { amount: true },
    }),
    computeStockPreview(outletId, user.id, timeRange),
    getStockDraft(outletId, user.id, sessionDate),
    prisma.rawMaterial.findMany({ where: { status: "ACTIVE" }, orderBy: [{ group: "asc" }, { sortOrder: "asc" }] }),
    getMaterialDraft(outletId, user.id, sessionDate),
    prisma.dailyReport.findUnique({ where: { outletId_pramuniagaId_date: { outletId, pramuniagaId: user.id, date: sessionDate } } }),
    // High enough to cover several months of history (the list has its own
    // filter/sort UI to browse it) rather than only the most recent 2 weeks.
    prisma.dailyReport.findMany({ where: { pramuniagaId: user.id }, orderBy: { date: "desc" }, take: 200 }),
  ]);

  // No cashier-entered figures saved for this session yet — suggest the
  // system-computed numbers (real POS sales/laku for this shift) as a
  // starting point; the cashier reviews and saves them (or overrides).
  const manualEntry = savedManualEntry
    ? {
        gofoodAmount: Number(savedManualEntry.gofoodAmount),
        grabAmount: Number(savedManualEntry.grabAmount),
        shopeeAmount: Number(savedManualEntry.shopeeAmount),
        tiktokAmount: Number(savedManualEntry.tiktokAmount),
        qponAmount: Number(savedManualEntry.qponAmount),
        cashlessAmount: Number(savedManualEntry.cashlessAmount),
        qtyKopdes: savedManualEntry.qtyKopdes,
        qtyMbg: savedManualEntry.qtyMbg,
      }
    : await (async () => {
        const [suggestedOnline, suggestedPotongan] = await Promise.all([
          computeOnlineCashlessBreakdown(outletId, user.id, timeRange),
          computePotonganPenjualan(outletId, user.id, timeRange, settings),
        ]);
        const byChannel = new Map(suggestedOnline.lines.map((l) => [l.channel, l.amount]));
        return {
          gofoodAmount: byChannel.get("GOFOOD") ?? 0,
          grabAmount: byChannel.get("GRAB") ?? 0,
          shopeeAmount: byChannel.get("SHOPEE") ?? 0,
          tiktokAmount: byChannel.get("TIKTOK") ?? 0,
          qponAmount: byChannel.get("QPON") ?? 0,
          cashlessAmount: byChannel.get("CASHLESS") ?? 0,
          qtyKopdes: suggestedPotongan.qtyKopdes,
          qtyMbg: suggestedPotongan.qtyMbg,
        };
      })();

  const categoryTotals = new Map(categoryTotalsRaw.map((r) => [r.category, Number(r._sum.amount ?? 0)]));
  const operationalTotal = allCategories.reduce((sum, c) => sum + (categoryTotals.get(c.key) ?? 0), 0);
  const kasbonTotal = kasbonList.reduce((sum, k) => sum + Number(k.amount), 0);
  const promoAmount = Number(promo?.amount ?? 0);

  // Each pramuniaga checks in independently — shown as separate name+shift
  // rows on the page (see PramuniagaShiftEntry), not merged into one string.
  const reportTeam = reportAttendanceRecords
    .filter((r) => r.pramuniagaRoster)
    .map((r) => ({ name: r.pramuniagaRoster!.name, shift: SHIFT_LABELS[r.shift] ?? r.shift }));
  const sessionDateLabel = dateLabelFormat.format(sessionDate);

  const categoryLabelByKey = new Map(allCategories.map((c) => [c.key, c.label]));
  const openSessionParticipantNames = openSessions.map((s) => s.pramuniagaRoster?.name).filter((n): n is string => Boolean(n));
  const pramuniagaName = openSessionParticipantNames.length > 0 ? formatParticipantNames(openSessionParticipantNames) : user.name;
  // Who a kasbon can be attributed to — anyone on shift for the report's own
  // date (checked in or already checked out), not "currently open sessions"
  // — the latter is always empty once editing a past, already-closed-out day.
  const kasbonRosterOptions = reportAttendanceRecords
    .filter((s) => s.pramuniagaRoster)
    .map((s) => ({ id: s.pramuniagaRosterId!, name: s.pramuniagaRoster!.name }));

  // Shift label(s) per Riwayat Setoran row — a report is one row per day,
  // but (since a shift can be staffed by more than one pramuniaga) that day
  // may have covered more than one shift; shown combined per date.
  const historyAttendance = await prisma.attendanceRecord.findMany({
    where: { userId: user.id, date: { in: reportHistory.map((r) => r.date) } },
    select: { date: true, shift: true },
  });
  const shiftLabelsByDate = new Map<string, string>();
  for (const a of historyAttendance) {
    const key = a.date.toISOString();
    const label = SHIFT_LABELS[a.shift] ?? a.shift;
    const existingLabels = shiftLabelsByDate.get(key);
    if (!existingLabels) shiftLabelsByDate.set(key, label);
    else if (!existingLabels.split(", ").includes(label)) shiftLabelsByDate.set(key, `${existingLabels}, ${label}`);
  }

  return (
    <SetoranOutletView
      outletName={outlet?.name ?? "-"}
      regionName={outlet?.region.name ?? "-"}
      pramuniagaName={pramuniagaName}
      reportTeam={reportTeam}
      sessionDateLabel={sessionDateLabel}
      alreadySubmitted={Boolean(sessionReport && sessionReport.status === "APPROVED")}
      // Pre-filled from the report being revised so "Kirim Ulang ke SPV"
      // isn't disabled on a blank Actual Cash field just because the
      // pramuniaga didn't retype a number that hadn't actually changed.
      initialActualCashCounted={editableDate && sessionReport ? Number(sessionReport.actualCashCounted) : null}
      initialNotes={editableDate ? (sessionReport?.notes ?? null) : null}
      stockPreview={stockPreview}
      stockDraft={stockDraft}
      materials={materials.map((m) => ({ id: m.id, name: m.name, unit: m.unit, group: m.group }))}
      materialDraft={materialDraft}
      manualEntry={manualEntry}
      kopdesRate={settings.paketHematKopdesDiscount}
      mbgRate={settings.paketHematMbgDiscount}
      promoAmount={promoAmount}
      categories={allCategories.filter((c) => c.status === "ACTIVE").map((c) => ({ key: c.key, label: c.label }))}
      kasbonList={kasbonList.map((k) => ({
        id: k.id,
        amount: Number(k.amount),
        notes: k.notes,
        date: dateOnlyString(k.date),
        pramuniagaName: k.pramuniagaRoster?.name ?? pramuniagaName,
        outletName: outlet?.name ?? "-",
        regionName: outlet?.region.name ?? "-",
      }))}
      kasbonTotal={kasbonTotal}
      kasbonRosterOptions={kasbonRosterOptions}
      categoryBreakdown={allCategories.map((c) => ({
        category: c.key,
        label: c.label,
        amount: categoryTotals.get(c.key) ?? 0,
      }))}
      operationalTotal={operationalTotal}
      expenseHistory={expenseHistory.map((e) => ({
        id: e.id,
        category: e.category,
        categoryLabel: categoryLabelByKey.get(e.category) ?? e.category,
        amount: Number(e.amount),
        description: e.description,
        approvalStatus: e.approvalStatus,
        createdAt: e.createdAt.toISOString(),
      }))}
      rangeFrom={dateOnlyString(rangeFrom)}
      rangeTo={dateOnlyString(rangeTo)}
      todayStr={dateOnlyString(sessionDate)}
      editDate={editableDate ? dateOnlyString(editableDate) : null}
      reportHistory={reportHistory.map((r) => ({
        id: r.id,
        date: r.date.toLocaleDateString("id-ID"),
        dateISO: dateOnlyString(r.date),
        dateFull: fullDateLabelFormat.format(r.date),
        isSessionDate: r.date.getTime() === sessionDate.getTime(),
        shiftLabel: shiftLabelsByDate.get(r.date.toISOString()) ?? "-",
        omset: Number(r.omset),
        summarySetoran: Number(r.summarySetoran),
        actualCashCounted: Number(r.actualCashCounted),
        variance: Number(r.variance),
        status: r.status,
      }))}
    />
  );
}
