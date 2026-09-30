import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MonthlyReportTable, type MonthlyReportRow } from "@/components/finance/monthly-report-table";

const DAYS_IN_MONTH = (year: number, month0: number) => new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();

// Laporan Pembanding Outlet — Omset %/Nominal and Sisa Stock Qty/Nominal,
// each compared across outlets AND across wilayah (region), Jan-Dec of the
// selected year. Omset/target reuse the same DailyReport + OutletMonthlyTarget
// data /executive already reads; Sisa Stock walks InventoryRecord's daily
// closingBalance forward per product, taking whichever record is latest
// within (or before) each month — the same "carry forward until the next
// entry" logic a real stock ledger uses.
export default async function PembandingOutletPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "finance:view_ledger")) redirect("/dashboard");

  const now = new Date();
  const { year: yearParam } = await searchParams;
  const year = yearParam ? Number(yearParam) : now.getFullYear();
  const upToMonth = year === now.getFullYear() ? now.getMonth() : 11;
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

  const [outlets, monthlyTargets, omsetRows, records] = await Promise.all([
    prisma.outlet.findMany({ where: { status: "ACTIVE" }, include: { region: true }, orderBy: { name: "asc" } }),
    prisma.outletMonthlyTarget.findMany({ where: { year } }),
    prisma.dailyReport.findMany({
      where: { status: "APPROVED", date: { gte: yearStart, lte: yearEnd } },
      select: { outletId: true, date: true, omset: true },
    }),
    prisma.inventoryRecord.findMany({
      where: { date: { gte: yearStart, lte: yearEnd } },
      select: { outletId: true, productId: true, date: true, closingBalance: true, product: { select: { cost: true } } },
      orderBy: { date: "asc" },
    }),
  ]);

  const zero12 = () => Array.from({ length: 12 }, () => 0);

  // Omset per outlet, Jan-Dec.
  const omsetByOutlet = new Map<string, number[]>();
  for (const r of omsetRows) {
    const arr = omsetByOutlet.get(r.outletId) ?? zero12();
    arr[r.date.getUTCMonth()] += Number(r.omset);
    omsetByOutlet.set(r.outletId, arr);
  }

  // Target per outlet, Jan-Dec (seasonal OutletMonthlyTarget, falling back
  // to the outlet's static dailyTarget * days-in-month).
  const targetByOutletMonth = new Map(monthlyTargets.map((t) => [`${t.outletId}|${t.month}`, Number(t.dailyTarget)]));
  const targetByOutlet = new Map<string, number[]>();
  for (const o of outlets) {
    const arr = zero12();
    for (let m = 0; m < 12; m++) {
      const daily = targetByOutletMonth.get(`${o.id}|${m + 1}`) ?? Number(o.dailyTarget);
      arr[m] = daily * DAYS_IN_MONTH(year, m);
    }
    targetByOutlet.set(o.id, arr);
  }

  const pctByOutlet = new Map<string, number[]>();
  for (const o of outlets) {
    const omset = omsetByOutlet.get(o.id) ?? zero12();
    const target = targetByOutlet.get(o.id)!;
    pctByOutlet.set(o.id, omset.map((v, i) => (target[i] > 0 ? Math.round((v / target[i]) * 100) : 0)));
  }

  // Sisa stock per outlet, Jan-Dec — carry each product's latest
  // closingBalance forward across months (a product with no movement in a
  // given month keeps its last-known balance, exactly like a real ledger).
  type ProductState = { balance: number; nominal: number };
  const byOutletProduct = new Map<string, typeof records>();
  for (const r of records) {
    const key = `${r.outletId}|${r.productId}`;
    const arr = byOutletProduct.get(key) ?? [];
    arr.push(r);
    byOutletProduct.set(key, arr);
  }
  const stockQtyByOutlet = new Map<string, number[]>();
  const stockNominalByOutlet = new Map<string, number[]>();
  for (const o of outlets) {
    const qtyArr = zero12();
    const nominalArr = zero12();
    stockQtyByOutlet.set(o.id, qtyArr);
    stockNominalByOutlet.set(o.id, nominalArr);
  }
  const productKeysByOutlet = new Map<string, Set<string>>();
  for (const key of byOutletProduct.keys()) {
    const [outletId, productId] = key.split("|");
    const set = productKeysByOutlet.get(outletId) ?? new Set<string>();
    set.add(productId);
    productKeysByOutlet.set(outletId, set);
  }
  for (const [outletId, productIds] of productKeysByOutlet) {
    const qtyArr = stockQtyByOutlet.get(outletId)!;
    const nominalArr = stockNominalByOutlet.get(outletId)!;
    for (const productId of productIds) {
      const rows = byOutletProduct.get(`${outletId}|${productId}`)!;
      let state: ProductState = { balance: 0, nominal: 0 };
      let rowIdx = 0;
      for (let m = 0; m < 12; m++) {
        const monthEnd = new Date(Date.UTC(year, m + 1, 0, 23, 59, 59, 999));
        while (rowIdx < rows.length && rows[rowIdx].date <= monthEnd) {
          const r = rows[rowIdx];
          state = { balance: r.closingBalance, nominal: r.closingBalance * Number(r.product.cost) };
          rowIdx++;
        }
        qtyArr[m] += state.balance;
        nominalArr[m] += state.nominal;
      }
    }
  }

  // ── Regional roll-ups (sum of each region's own outlets) ──────────────
  const regionIds = [...new Set(outlets.map((o) => o.regionId))];
  const regionNameById = new Map(outlets.map((o) => [o.regionId, o.region.name]));
  function regionSeries(perOutlet: Map<string, number[]>, mode: "sum" | "avg"): Map<string, number[]> {
    const out = new Map<string, number[]>();
    for (const regionId of regionIds) {
      const regionOutlets = outlets.filter((o) => o.regionId === regionId);
      const combined = zero12();
      for (const o of regionOutlets) {
        const s = perOutlet.get(o.id) ?? zero12();
        s.forEach((v, i) => (combined[i] += v));
      }
      if (mode === "avg" && regionOutlets.length > 0) combined.forEach((v, i) => (combined[i] = Math.round(v / regionOutlets.length)));
      out.set(regionId, combined);
    }
    return out;
  }
  const omsetByRegion = regionSeries(omsetByOutlet, "sum");
  const pctByRegion = regionSeries(pctByOutlet, "avg");
  const stockQtyByRegion = regionSeries(stockQtyByOutlet, "sum");
  const stockNominalByRegion = regionSeries(stockNominalByOutlet, "sum");

  function rowsFor(entries: { id: string; name: string }[], data: Map<string, number[]>, totalMode: "sum" | "average" | "latest"): MonthlyReportRow[] {
    return entries.map((e) => ({ label: e.name, values: data.get(e.id) ?? zero12(), totalMode }));
  }

  const outletEntries = outlets.map((o) => ({ id: o.id, name: o.name }));
  const regionEntries = regionIds.map((id) => ({ id, name: regionNameById.get(id) ?? id }));

  const years5 = years;

  function section(title: string, rows: MonthlyReportRow[], totalLabel: string) {
    return (
      <Card className="p-0">
        <div className="sticky top-16 z-30 flex h-11 items-center rounded-t-xl bg-brand-950 px-5">
          <p className="text-sm font-bold uppercase tracking-wide text-white">{title}</p>
        </div>
        <MonthlyReportTable rows={rows} year={year} upToMonth={upToMonth} totalLabel={totalLabel} />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan Pembanding Outlet"
        description="Omset (% & nominal) dan Sisa Stock (qty & nominal), dibandingkan antar outlet dan antar wilayah, per bulan."
      />

      <Card>
        <form className="flex flex-wrap items-end gap-3 p-5">
          <div>
            <Label className="text-[11px]">Tahun</Label>
            <Select name="year" defaultValue={String(year)} className="mt-1">
              {years5.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="secondary">
            Tampilkan
          </Button>
        </form>
      </Card>

      <p className="px-1 text-sm font-bold uppercase tracking-wide text-slate-400">Per Outlet</p>
      {section("Persentase Pencapaian Omset per Outlet", rowsFor(outletEntries, pctByOutlet, "average"), "Rata-rata")}
      {section("Nominal Omset per Outlet", rowsFor(outletEntries, omsetByOutlet, "sum"), `Total ${year}`)}
      {section("Sisa Stock (Quantity) per Outlet", rowsFor(outletEntries, stockQtyByOutlet, "latest"), "Posisi Terakhir")}
      {section("Sisa Stock (Nominal) per Outlet", rowsFor(outletEntries, stockNominalByOutlet, "latest"), "Posisi Terakhir")}

      <p className="px-1 text-sm font-bold uppercase tracking-wide text-slate-400">Per Wilayah</p>
      {section("Persentase Pencapaian Omset per Wilayah", rowsFor(regionEntries, pctByRegion, "average"), "Rata-rata")}
      {section("Nominal Omset per Wilayah", rowsFor(regionEntries, omsetByRegion, "sum"), `Total ${year}`)}
      {section("Sisa Stock (Quantity) per Wilayah", rowsFor(regionEntries, stockQtyByRegion, "latest"), "Posisi Terakhir")}
      {section("Sisa Stock (Nominal) per Wilayah", rowsFor(regionEntries, stockNominalByRegion, "latest"), "Posisi Terakhir")}
    </div>
  );
}
