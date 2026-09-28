import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { isOutletInScope } from "@/lib/outlet-scope";
import { getBusinessSettings } from "@/lib/business-settings";

const SHIFT_LABELS: Record<string, string> = { SHIFT_1: "Shift 1", SHIFT_2: "Shift 2", FULLSHIFT: "Fullshift" };

// Full read-only reconstruction of one past daily report — everything the
// live Laporan Harian page shows (Informasi Outlet through Total Fisik
// Cash), sourced from that day's own saved rows rather than live-recomputed,
// for the Riwayat Setoran list's "view full report" expansion.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser();
  if (!user) return response!;

  const { id } = await params;

  const report = await prisma.dailyReport.findUnique({
    where: { id },
    include: {
      outlet: { include: { region: true } },
      stockLines: { orderBy: { sortOrder: "asc" } },
      materialLines: { include: { rawMaterial: true } },
    },
  });
  if (!report) return NextResponse.json({ error: "Laporan tidak ditemukan" }, { status: 404 });
  // Either the pramuniaga who owns this report (the shared outlet login), or
  // a validating role (SPV/OFFICE/FA_ADMIN/MASTER_ADMIN) whose scope covers
  // this outlet — SPV needs the full breakdown to actually inspect a report
  // before approving/rejecting it, not just the one-line summary.
  const isOwner = report.pramuniagaId === user.id;
  const canValidate = can(user.role, "report:validate") && (await isOutletInScope(user.id, user.role, report.outletId));
  if (!isOwner && !canValidate) {
    return NextResponse.json({ error: "Tidak memiliki akses ke laporan ini" }, { status: 403 });
  }

  // Every lookup below is keyed to the REPORT'S OWN pramuniaga, not the
  // viewing user — otherwise an SPV viewing someone else's report would
  // pull back their own (empty/irrelevant) attendance, expenses, etc.
  const reportOwnerId = report.pramuniagaId;

  const [team, manualEntry, promo, kasbonList, expenseRecords, expenseCategories, settings] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { userId: reportOwnerId, date: report.date },
      include: { pramuniagaRoster: true },
      orderBy: { timeIn: "asc" },
    }),
    prisma.expenseManualEntry.findUnique({ where: { outletId_pramuniagaId_date: { outletId: report.outletId, pramuniagaId: reportOwnerId, date: report.date } } }),
    prisma.promoDiscount.findUnique({ where: { outletId_pramuniagaId_date: { outletId: report.outletId, pramuniagaId: reportOwnerId, date: report.date } } }),
    prisma.kasbon.findMany({ where: { outletId: report.outletId, pramuniagaId: reportOwnerId, date: report.date }, include: { pramuniagaRoster: true } }),
    prisma.expenseRecord.findMany({ where: { outletId: report.outletId, submittedById: reportOwnerId, date: report.date } }),
    prisma.expenseCategoryDef.findMany({ orderBy: { sortOrder: "asc" } }),
    getBusinessSettings(),
  ]);

  const categoryLabelByKey = new Map(expenseCategories.map((c) => [c.key, c.label]));
  const operationalByCategory = new Map<string, number>();
  for (const e of expenseRecords) {
    operationalByCategory.set(e.category, (operationalByCategory.get(e.category) ?? 0) + Number(e.amount));
  }
  const operationalTotal = expenseRecords.reduce((sum, e) => sum + Number(e.amount), 0);

  const kopdesAmount = (manualEntry?.qtyKopdes ?? 0) * settings.paketHematKopdesDiscount;
  const mbgAmount = (manualEntry?.qtyMbg ?? 0) * settings.paketHematMbgDiscount;
  const promoAmount = Number(promo?.amount ?? 0);
  const kasbonTotal = kasbonList.reduce((sum, k) => sum + Number(k.amount), 0);

  // The manual-entry breakdown is itemized/cross-check detail (sections 2-3)
  // — the Rekap Summary's own 4 tiles use the report's stored aggregates
  // instead (report.nonTunai/potongan/expenses), since those are what
  // actually determined its saved variance/status and must stay consistent
  // with them, even if a manual entry was edited after submission.
  const onlineCashlessManualTotal = manualEntry
    ? Number(manualEntry.gofoodAmount) +
      Number(manualEntry.grabAmount) +
      Number(manualEntry.shopeeAmount) +
      Number(manualEntry.tiktokAmount) +
      Number(manualEntry.qponAmount) +
      Number(manualEntry.cashlessAmount)
    : 0;
  const potonganManualTotal = kopdesAmount + mbgAmount + promoAmount;

  type MaterialLine = { name: string; unit: string; qtyUsed: number };
  const materialsByGroup: Record<"DAGING" | "SAYUR" | "SAOS_KEMASAN", MaterialLine[]> = { DAGING: [], SAYUR: [], SAOS_KEMASAN: [] };
  for (const l of report.materialLines) {
    materialsByGroup[l.rawMaterial.group].push({ name: l.rawMaterial.name, unit: l.rawMaterial.unit, qtyUsed: Number(l.qtyUsed) });
  }

  return NextResponse.json({
    date: report.date,
    outletName: report.outlet.name,
    regionName: report.outlet.region.name,
    team: team.filter((t) => t.pramuniagaRoster).map((t) => ({ name: t.pramuniagaRoster!.name, shift: SHIFT_LABELS[t.shift] ?? t.shift })),
    status: report.status,
    spvNotes: report.spvNotes,
    stockLines: report.stockLines.map((l) => ({
      itemName: l.itemName,
      unitPrice: Number(l.unitPrice),
      ambil: l.ambil,
      sisa: l.sisa,
      terjualSistem: l.terjualSistem,
      laku: l.ambil || l.sisa ? l.ambil - l.sisa : l.terjualSistem,
    })),
    materialsByGroup,
    onlineCashless: manualEntry
      ? {
          gofood: Number(manualEntry.gofoodAmount),
          grab: Number(manualEntry.grabAmount),
          shopee: Number(manualEntry.shopeeAmount),
          tiktok: Number(manualEntry.tiktokAmount),
          qpon: Number(manualEntry.qponAmount),
          cashless: Number(manualEntry.cashlessAmount),
        }
      : null,
    onlineCashlessManualTotal,
    potongan: { qtyKopdes: manualEntry?.qtyKopdes ?? 0, kopdesAmount, qtyMbg: manualEntry?.qtyMbg ?? 0, mbgAmount, promoAmount, promoNotes: promo?.notes ?? null },
    potonganManualTotal,
    kasbonList: kasbonList.map((k) => ({ name: k.pramuniagaRoster?.name ?? "-", notes: k.notes, amount: Number(k.amount) })),
    kasbonTotal,
    operationalByCategory: [...operationalByCategory.entries()].map(([key, amount]) => ({ key, label: categoryLabelByKey.get(key) ?? key, amount })),
    operationalTotal,
    rekap: {
      omset: Number(report.omset),
      nonTunai: Number(report.nonTunai),
      potongan: Number(report.potongan),
      expenses: Number(report.expenses),
      summarySetoran: Number(report.summarySetoran),
      kasbonTotal,
      totalFisikCash: Number(report.summarySetoran) - kasbonTotal,
    },
    actualCashCounted: Number(report.actualCashCounted),
    variance: Number(report.variance),
  });
}
