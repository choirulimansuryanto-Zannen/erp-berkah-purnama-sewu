import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { getScopedOutletIds } from "@/lib/outlet-scope";
import { computeTransactionBreakdowns } from "@/lib/transaction-history";
import { getSessionDate } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Label, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { HistoryTabs } from "@/components/transactions/history-tabs";
import { HeroStatCard } from "@/components/transactions/hero-stat-card";
import { Package, ShoppingBag, TrendingUp, Wallet } from "lucide-react";

const numberFormat = new Intl.NumberFormat("id-ID");

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const dateLabelFormat = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" });

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "transactions:view_history")) redirect("/dashboard");

  const { from, to } = await searchParams;
  // When no explicit range is picked, a pramuniaga defaults to their current
  // shift session's date rather than the calendar day — otherwise a shift
  // that's still open past midnight would show as "no transactions today".
  const defaultDay = from ? new Date(`${from}T00:00:00`) : user.role === "PRAMUNIAGA" ? await getSessionDate(user.id) : new Date();
  defaultDay.setHours(0, 0, 0, 0);

  const rangeFrom = from ? new Date(`${from}T00:00:00`) : new Date(defaultDay);
  rangeFrom.setHours(0, 0, 0, 0);
  // No `to` means a single-day view anchored on `from` (or the default day)
  // — clone rather than reuse the Date instance, since it gets its own
  // end-of-day mutation below and must not alias rangeFrom's start-of-day one.
  const rangeTo = to ? new Date(`${to}T00:00:00`) : new Date(rangeFrom);
  rangeTo.setHours(23, 59, 59, 999);

  let outletIds: string[];
  let scopeLabel: string;
  if (user.role === "PRAMUNIAGA") {
    if (!user.outletId) redirect("/dashboard");
    outletIds = [user.outletId];
    scopeLabel = user.outlet?.name ?? "outlet Anda";
  } else {
    const scoped = await getScopedOutletIds(user.id, user.role);
    if (scoped) {
      outletIds = scoped;
      scopeLabel = "region Anda";
    } else {
      const allOutlets = await prisma.outlet.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
      outletIds = allOutlets.map((o) => o.id);
      scopeLabel = "seluruh outlet";
    }
  }

  const [data, products, toppings] = await Promise.all([
    computeTransactionBreakdowns(outletIds, rangeFrom, rangeTo),
    prisma.product.findMany({ where: { status: "ACTIVE" }, orderBy: [{ category: "asc" }, { sortOrder: "asc" }] }),
    prisma.topping.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
  ]);
  const fromStr = localDateStr(rangeFrom);
  const toStr = localDateStr(rangeTo);
  const isSameDay = fromStr === toStr;
  const periodLabel = isSameDay
    ? dateLabelFormat.format(rangeFrom)
    : `${dateLabelFormat.format(rangeFrom)} – ${dateLabelFormat.format(rangeTo)}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Riwayat Transaksi"
        description={`Rincian transaksi ${scopeLabel} — ${periodLabel}.`}
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <form className="flex flex-wrap items-end gap-2">
              <div>
                <Label htmlFor="from">Dari Tanggal</Label>
                <Input id="from" type="date" name="from" defaultValue={fromStr} max={localDateStr(new Date())} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="to">Sampai Tanggal</Label>
                <Input id="to" type="date" name="to" defaultValue={toStr} max={localDateStr(new Date())} className="mt-1" />
              </div>
              <Button type="submit" variant="secondary">
                Tampilkan
              </Button>
            </form>
            {user.role === "PRAMUNIAGA" && (
              <Link href="/pos">
                <Button variant="outline" size="sm">
                  ← Kembali ke Kasir
                </Button>
              </Link>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <HeroStatCard
          variant="hero"
          label="Total Omset"
          value={currency.format(data.summary.omset)}
          subtitle={`${numberFormat.format(data.summary.orders)} transaksi berhasil tercatat`}
          icon={<Wallet className="h-4 w-4" />}
        />
        <HeroStatCard
          label="Jumlah Pesanan"
          value={numberFormat.format(data.summary.orders)}
          subtitle="Sepanjang periode terpilih"
          icon={<ShoppingBag className="h-4 w-4" />}
        />
        <HeroStatCard
          label="AOV"
          value={currency.format(data.summary.aov)}
          subtitle="Rata-rata nilai per transaksi"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <HeroStatCard
          label="Total Porsi Terjual"
          value={`${numberFormat.format(data.porsi.total)} Porsi`}
          icon={<Package className="h-4 w-4" />}
        >
          <div className="mt-3 space-y-1.5 border-t border-white/10 pt-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Alacarte</span>
              <span className="font-semibold text-white">{numberFormat.format(data.porsi.alacarte)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Paket</span>
              <span className="font-semibold text-white">{numberFormat.format(data.porsi.paket)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Produk Pelengkap</span>
              <span className="font-semibold text-white">{numberFormat.format(data.porsi.produkPelengkap)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Topping</span>
              <span className="font-semibold text-white">{numberFormat.format(data.porsi.topping)}</span>
            </div>
          </div>
        </HeroStatCard>
      </div>

      <Card className="p-5">
        <HistoryTabs
          byChannel={data.byChannel}
          byCustomerModel={data.byCustomerModel}
          byPaymentModel={data.byPaymentModel}
          customerModelGroups={data.customerModelGroups}
          paymentModelGroups={data.paymentModelGroups}
          byProduct={data.byProduct}
          byMember={data.byMember}
          memberSegments={data.memberSegments}
          byPeriod={data.byPeriod}
          transactions={data.transactions.map((t) => ({ ...t, time: t.time.toISOString() }))}
          showDate={!isSameDay}
          products={products.map((p) => ({ id: p.id, name: p.name, category: p.category, price: Number(p.price) }))}
          toppings={toppings.map((t) => ({ id: t.id, name: t.name, price: Number(t.price) }))}
        />
      </Card>
    </div>
  );
}
