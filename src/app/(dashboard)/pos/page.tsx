import Link from "next/link";
import { History, LogIn } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { PosTerminal } from "@/components/pos/pos-terminal";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { formatParticipantNames } from "@/lib/attendance-participants";

export default async function PosPage() {
  const user = await getCurrentUser();

  // A cashier session must be opened (check-in) before ringing up sales —
  // every transaction needs an active session to attribute it to. The open
  // session also carries the roster name declared at check-in, which is the
  // "real" identity for the shift — shown on the terminal instead of the
  // (possibly shared/outlet-level) login account name.
  // Each pramuniaga checks in independently now, so there may be several
  // open rows for this login at once — combined for the receipt's Kasir line.
  const openSessions =
    user?.role === "PRAMUNIAGA"
      ? await prisma.attendanceRecord.findMany({
          where: { userId: user.id, timeOut: null },
          include: { pramuniagaRoster: true },
          orderBy: { timeIn: "asc" },
        })
      : [];
  const openSession = openSessions[0] ?? null;
  const openSessionParticipantNames = openSessions.map((s) => s.pramuniagaRoster?.name).filter((n): n is string => Boolean(n));

  if (user?.role === "PRAMUNIAGA" && !openSession) {
    return (
      <div className="space-y-5">
        <PageHeader title="POS / Kasir" description="Pilih produk, lalu proses pembayaran." />
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <LogIn className="h-7 w-7" />
          </div>
          <div>
            <p className="text-base font-semibold text-slate-900">Belum Check-in</p>
            <p className="mt-1 text-sm text-slate-500">Check-in dulu untuk memulai sesi kasir sebelum bisa transaksi.</p>
          </div>
          <Link href="/attendance">
            <Button size="lg">
              <LogIn className="h-4 w-4" />
              Check In Sekarang
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const [products, toppings, channelRules, packageComponents] = await Promise.all([
    prisma.product.findMany({ where: { status: "ACTIVE" }, orderBy: [{ category: "asc" }, { sortOrder: "asc" }] }),
    prisma.topping.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.categoryChannelRule.findMany(),
    prisma.packageComponent.findMany({
      include: { componentProduct: { select: { name: true } }, componentTopping: { select: { name: true } } },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const compositionByProductId = new Map<string, { name: string; qty: number }[]>();
  for (const c of packageComponents) {
    const name = c.componentProduct?.name ?? c.componentTopping?.name;
    if (!name) continue;
    const list = compositionByProductId.get(c.packageProductId) ?? [];
    list.push({ name, qty: c.qty });
    compositionByProductId.set(c.packageProductId, list);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="POS / Kasir"
        description="Pilih produk, lalu proses pembayaran."
        actions={
          <Link href="/transactions">
            <Button variant="outline" size="sm">
              <History className="h-3.5 w-3.5" />
              Riwayat Transaksi
            </Button>
          </Link>
        }
      />
      <PosTerminal
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          price: Number(p.price),
          composition: compositionByProductId.get(p.id),
        }))}
        toppings={toppings.map((t) => ({ id: t.id, name: t.name, price: Number(t.price) }))}
        outletName={user?.outlet?.name}
        cashierName={openSessionParticipantNames.length > 0 ? formatParticipantNames(openSessionParticipantNames) : user?.name}
        channelRules={channelRules.map((r) => ({ category: r.category, allowedChannels: r.allowedChannels }))}
      />
    </div>
  );
}
