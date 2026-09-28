import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { getScopedOutletIds } from "@/lib/outlet-scope";
import { toDateOnlyKey, getSessionDate, getSessionTimeRange, startOfToday } from "@/lib/session";
import { computeFreezerUsedByName } from "@/lib/freezer-stock";
import { computeJpdSummary, JPD_DAGING_4KG_NAME, JPD_DAGING_2KG_NAME } from "@/lib/jpd";
import { DailyCheckForm } from "@/components/inventory/daily-check-form";
import { AdjustmentList } from "@/components/inventory/adjustment-list";
import { RegionalStockSummary } from "@/components/inventory/regional-stock-summary";
import { FreezerStockTable, type FreezerRow } from "@/components/inventory/freezer-stock-table";
import { JpdOutletCard } from "@/components/inventory/jpd-outlet-card";
import { PageHeader } from "@/components/ui/page-header";
import { Label, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const dateLabelFormat = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

function dateOnlyString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;

  const canRecord = can(user.role, "inventory:record_check");
  const canDecide = can(user.role, "inventory:approve_adjustment");
  const canViewSummary = can(user.role, "inventory:view_summary");
  // Pramuniaga no longer submits ad-hoc stock checks/adjustments here —
  // "saldo masuk" (goods received) becomes a PO-driven flow owned by SPV
  // instead. OPS_ADMIN (the only other role with inventory:record_check)
  // keeps this form unchanged.
  const isPramuniaga = user.role === "PRAMUNIAGA";

  let freezerSection: React.ReactNode = null;
  if (canRecord && user.outletId) {
    const outletId = user.outletId;
    const { date: dateParam } = await searchParams;
    const sessionDate = await getSessionDate(user.id);
    const selectedDate = dateParam ? new Date(`${dateParam}T00:00:00.000Z`) : sessionDate;
    const isSessionDate = dateOnlyString(selectedDate) === dateOnlyString(sessionDate);

    const [materials, existingRecords] = await Promise.all([
      prisma.freezerMaterial.findMany({ where: { status: "ACTIVE" }, orderBy: { sortOrder: "asc" } }),
      prisma.freezerStockRecord.findMany({ where: { outletId, date: selectedDate } }),
    ]);
    const recordByMaterialId = new Map(existingRecords.map((r) => [r.freezerMaterialId, r]));

    // Only the session's own date shows live Pakai (recomputed fresh from
    // today's sales/usage) — a past date shown via the filter is history,
    // read from whatever was actually saved that day, not recalculated.
    const liveUsedByName = isSessionDate
      ? await computeFreezerUsedByName(
          outletId,
          user.id,
          sessionDate,
          (await getSessionTimeRange(user.id)) ?? { from: startOfToday(), to: new Date() },
        )
      : {};

    const freezerRows: FreezerRow[] = materials.map((m) => {
      const existing = recordByMaterialId.get(m.id);
      const used = isSessionDate ? (liveUsedByName[m.name] ?? 0) : (existing?.used ?? 0);
      const openingBalance = existing?.openingBalance ?? 0;
      const received = existing?.received ?? 0;
      const rejected = existing?.rejected ?? 0;
      return {
        id: m.id,
        name: m.name,
        unit: m.unit,
        minStock: m.minStock,
        openingBalance,
        received,
        used,
        rejected,
        closingBalance: existing ? existing.closingBalance : openingBalance + received - used - rejected,
      };
    });

    // JPD ("Total produk ÷ (Daging 4kg + Daging 2kg × 0.5)") accumulates
    // Pakai for the two Daging materials from the 1st of the month through
    // the selected date — saved history for prior days, the same live
    // recompute as the table above for today.
    const monthStartUtc = new Date(Date.UTC(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth(), 1));
    const dagingSavedSums = await prisma.freezerStockRecord.groupBy({
      by: ["freezerMaterialId"],
      where: {
        outletId,
        date: isSessionDate ? { gte: monthStartUtc, lt: selectedDate } : { gte: monthStartUtc, lte: selectedDate },
      },
      _sum: { used: true },
    });
    const savedUsedByMaterialId = new Map(dagingSavedSums.map((s) => [s.freezerMaterialId, Number(s._sum.used ?? 0)]));
    const daging4kgId = materials.find((m) => m.name === JPD_DAGING_4KG_NAME)?.id;
    const daging2kgId = materials.find((m) => m.name === JPD_DAGING_2KG_NAME)?.id;
    const daging4kgUsed =
      (daging4kgId ? (savedUsedByMaterialId.get(daging4kgId) ?? 0) : 0) + (isSessionDate ? (liveUsedByName[JPD_DAGING_4KG_NAME] ?? 0) : 0);
    const daging2kgUsed =
      (daging2kgId ? (savedUsedByMaterialId.get(daging2kgId) ?? 0) : 0) + (isSessionDate ? (liveUsedByName[JPD_DAGING_2KG_NAME] ?? 0) : 0);

    const jpdSummary = await computeJpdSummary({ outletId, throughDate: selectedDate, daging4kgUsed, daging2kgUsed });

    freezerSection = (
      <div className="space-y-3">
        <form className="flex flex-wrap items-end gap-2">
          <div>
            <Label className="text-[11px]">Lihat Tanggal</Label>
            <Input type="date" name="date" defaultValue={dateOnlyString(selectedDate)} max={dateOnlyString(sessionDate)} className="mt-1" />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Tampilkan
          </Button>
        </form>
        <FreezerStockTable rows={freezerRows} editable={isSessionDate} dateLabel={dateLabelFormat.format(selectedDate)} />
        <JpdOutletCard
          totalProdukKetul={jpdSummary.totalProdukKetul}
          pemakaianDaging={jpdSummary.pemakaianDaging}
          jpd={jpdSummary.jpd}
          dateLabel={dateLabelFormat.format(selectedDate)}
        />
      </div>
    );
  }

  const [products, adjustments] = await Promise.all([
    isPramuniaga ? Promise.resolve([]) : prisma.product.findMany({ where: { status: "ACTIVE" }, orderBy: [{ category: "asc" }, { sortOrder: "asc" }] }),
    isPramuniaga
      ? Promise.resolve([])
      : canDecide
        ? prisma.stockAdjustment.findMany({
            where: { status: "PENDING" },
            include: { outlet: true, product: true, requester: true },
            orderBy: { createdAt: "desc" },
          })
        : canRecord
          ? prisma.stockAdjustment.findMany({
              where: { requestedById: user.id },
              include: { outlet: true, product: true, requester: true },
              orderBy: { createdAt: "desc" },
              take: 20,
            })
          : Promise.resolve([]),
  ]);

  let summaryData: Awaited<ReturnType<typeof loadStockSummary>> | null = null;
  if (canViewSummary) {
    const scoped = await getScopedOutletIds(user.id, user.role);
    summaryData = await loadStockSummary(scoped);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" description="Stock check harian dan pengajuan penyesuaian stok." />
      {freezerSection}
      {canRecord && !isPramuniaga && <DailyCheckForm products={products.map((p) => ({ id: p.id, name: p.name }))} />}
      {summaryData && <RegionalStockSummary outlets={summaryData} />}
      {(canRecord || canDecide) && !isPramuniaga && <AdjustmentList adjustments={adjustments} canDecide={canDecide} />}
      {!canRecord && !canDecide && !canViewSummary && (
        <p className="text-sm text-slate-500">Tidak ada data inventory untuk role ini.</p>
      )}
    </div>
  );
}

async function loadStockSummary(scopedOutletIds: string[] | null) {
  const today = toDateOnlyKey(new Date());

  const outlets = await prisma.outlet.findMany({
    where: { status: "ACTIVE", ...(scopedOutletIds ? { id: { in: scopedOutletIds } } : {}) },
    orderBy: { name: "asc" },
  });

  const records = await prisma.inventoryRecord.findMany({
    where: { date: today, outletId: { in: outlets.map((o) => o.id) } },
  });

  return outlets.map((outlet) => {
    const outletRecords = records.filter((r) => r.outletId === outlet.id);
    return {
      id: outlet.id,
      name: outlet.name,
      submitted: outletRecords.length > 0,
      received: outletRecords.reduce((sum, r) => sum + r.received, 0),
      used: outletRecords.reduce((sum, r) => sum + r.used, 0),
      rejected: outletRecords.reduce((sum, r) => sum + r.rejected, 0),
      unreconciledCount: outletRecords.filter((r) => !r.reconciled).length,
    };
  });
}
