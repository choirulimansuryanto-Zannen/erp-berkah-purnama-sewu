import "server-only";
import type { Channel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatParticipantNames } from "@/lib/attendance-participants";

// A transaction counts as "new member register" when it landed shortly after
// the member's own createdAt — i.e. the register-then-checkout POS flow
// (register a walk-in as a member, then immediately ring up their first
// purchase), not just any transaction by a member who happens to have joined
// at some earlier, unrelated visit. 30 minutes comfortably covers that flow
// while staying tight enough not to misclassify a genuinely separate visit.
const NEW_MEMBER_WINDOW_MS = 30 * 60 * 1000;

// Per user spec: Offline = Cash+Cashless+Qpon+TikTok, Online = Grab+GoFood+Shopee.
const ONLINE_CHANNELS: Channel[] = ["GRAB", "GOFOOD", "SHOPEE"];
// Per user spec: Tunai = Cash, Non-Tunai = everything else.
const TUNAI_CHANNELS: Channel[] = ["CASH"];

// Which channels fall under each Customer Model / Payment Model group, for
// the "detailed" breakdown on those two tabs (each model's own row grouped
// with every channel underneath it, not just the 2-row model total). All
// 7 channels are listed either way, in a fixed order, so the table's shape
// never shifts depending on which channels happened to sell that period.
const CUSTOMER_MODEL_CHANNELS: [string, Channel[]][] = [
  ["Offline", ["CASH", "CASHLESS", "QPON", "TIKTOK"]],
  ["Online", ["GRAB", "GOFOOD", "SHOPEE"]],
];
const PAYMENT_MODEL_CHANNELS: [string, Channel[]][] = [
  ["Tunai", ["CASH"]],
  ["Non-Tunai", ["CASHLESS", "GRAB", "GOFOOD", "SHOPEE", "QPON", "TIKTOK"]],
];
// Per user spec: drink/complementary alacarte items are their own "porsi"
// bucket, separate from main food products — matched by name since there's
// no schema flag for it (deliberately not adding one for a 3-item list).
const PRODUK_PELENGKAP_NAMES = new Set(["Air Mineral Prima", "Teh Botol Sosro", "Fruit Tea"]);

type Stat = { omset: number; orders: number };

function withAov<T extends Stat>(entry: T): T & { aov: number } {
  return { ...entry, aov: entry.orders > 0 ? entry.omset / entry.orders : 0 };
}

function bump(map: Map<string, Stat>, key: string, total: number) {
  const entry = map.get(key) ?? { omset: 0, orders: 0 };
  entry.omset += total;
  entry.orders += 1;
  map.set(key, entry);
}

// Every channel under a model, in fixed order, defaulting missing ones to
// zero — plus the model's own subtotal, derived from its channels rather
// than re-read from byCustomerModel/byPaymentModel's own totals, so the two
// can never silently drift apart.
function groupChannelsByModel(byChannel: Map<Channel, Stat>, groups: [string, Channel[]][]) {
  return groups.map(([model, channels]) => {
    const channelRows = channels.map((channel) => ({ channel, ...withAov(byChannel.get(channel) ?? { omset: 0, orders: 0 }) }));
    const subtotal = channelRows.reduce(
      (acc, c) => ({ omset: acc.omset + c.omset, orders: acc.orders + c.orders }),
      { omset: 0, orders: 0 },
    );
    return { model, channels: channelRows, ...withAov(subtotal) };
  });
}

function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// A login account (e.g. "Pramuniaga Cilegon") can be used by whichever real
// roster member is on shift — the actual person is only known from the
// AttendanceRecord they checked into before ringing up the sale. Resolves
// per-transaction rather than trusting `transaction.pramuniaga.name` (the
// generic login), matching each sale to whichever session (timeIn..timeOut,
// spanning past midnight if needed) was open at the moment it was created.
// Falls back to the login name when no covering session is on record (e.g.
// older seed history predating attendance tracking).
function resolveKasirName(
  userId: string,
  createdAt: Date,
  loginName: string,
  attendance: {
    userId: string;
    timeIn: Date | null;
    timeOut: Date | null;
    pramuniagaRoster: { name: string } | null;
  }[],
): string {
  // Each pramuniaga checks in independently now, so more than one row can
  // cover the same instant (overlapping shifts) — combined into one label.
  const covering = attendance.filter(
    (a) =>
      a.userId === userId &&
      a.pramuniagaRoster &&
      a.timeIn !== null &&
      a.timeIn <= createdAt &&
      (a.timeOut === null || a.timeOut >= createdAt),
  );
  if (covering.length === 0) return loginName;
  return formatParticipantNames(covering.map((a) => a.pramuniagaRoster!.name));
}

export async function computeTransactionBreakdowns(outletIds: string[], dateFrom: Date, dateTo: Date) {
  const [transactions, attendance] = await Promise.all([
    prisma.transaction.findMany({
      where: { outletId: { in: outletIds }, status: "COMPLETED", createdAt: { gte: dateFrom, lte: dateTo } },
      include: {
        items: { include: { product: true, toppings: { include: { topping: true } } } },
        member: true,
        pramuniaga: true,
        outlet: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    // Small table — scoping by outlet (not date) keeps the lookup correct
    // even when a session's check-in date falls just outside [dateFrom, dateTo].
    prisma.attendanceRecord.findMany({
      where: { outletId: { in: outletIds } },
      select: { userId: true, timeIn: true, timeOut: true, pramuniagaRoster: { select: { name: true } } },
    }),
  ]);

  // Bucketed by hour when the period is a single calendar day (a daily
  // bucket would collapse to one useless point), otherwise by day.
  const singleDay = localDayKey(dateFrom) === localDayKey(dateTo);
  const byPeriod = new Map<string, { label: string; omset: number; orders: number }>();
  for (const t of transactions) {
    const key = singleDay ? `${String(t.createdAt.getHours()).padStart(2, "0")}:00` : localDayKey(t.createdAt);
    const label = singleDay ? key : t.createdAt.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
    const entry = byPeriod.get(key) ?? { label, omset: 0, orders: 0 };
    entry.omset += Number(t.total);
    entry.orders += 1;
    byPeriod.set(key, entry);
  }

  const byChannel = new Map<Channel, Stat>();
  const byCustomerModel = new Map<string, Stat>();
  const byPaymentModel = new Map<string, Stat>();
  const byMember = new Map<string, Stat & { name: string }>();
  const byProduct = new Map<string, { name: string; omset: number; qty: number; byChannel: Map<Channel, { qty: number; omset: number }> }>();

  let porsiAlacarte = 0;
  let porsiPaket = 0;
  let porsiPelengkap = 0;
  let porsiTopping = 0;

  // Three mutually-exclusive buckets every transaction falls into exactly
  // once: an existing loyalty member buying, a walk-in with no membership,
  // or someone registering as a member at the moment of this very purchase.
  let loyaltyOmset = 0;
  let loyaltyOrders = 0;
  const loyaltyMemberIds = new Set<string>();
  let nonMemberOmset = 0;
  let nonMemberOrders = 0;
  let newRegisterOmset = 0;
  let newRegisterOrders = 0;
  const segmentByTxId = new Map<string, "LOYALTY" | "NON_MEMBER" | "NEW_REGISTER">();

  for (const t of transactions) {
    const total = Number(t.total);

    bump(byChannel as unknown as Map<string, Stat>, t.channel, total);
    bump(byCustomerModel, ONLINE_CHANNELS.includes(t.channel) ? "Online" : "Offline", total);
    bump(byPaymentModel, TUNAI_CHANNELS.includes(t.channel) ? "Tunai" : "Non-Tunai", total);

    if (t.member) {
      const entry = byMember.get(t.member.id) ?? { omset: 0, orders: 0, name: t.member.name };
      entry.omset += total;
      entry.orders += 1;
      byMember.set(t.member.id, entry);

      const isNewRegister =
        t.createdAt.getTime() >= t.member.createdAt.getTime() &&
        t.createdAt.getTime() - t.member.createdAt.getTime() <= NEW_MEMBER_WINDOW_MS;
      if (isNewRegister) {
        newRegisterOmset += total;
        newRegisterOrders += 1;
        segmentByTxId.set(t.id, "NEW_REGISTER");
      } else {
        loyaltyOmset += total;
        loyaltyOrders += 1;
        loyaltyMemberIds.add(t.member.id);
        segmentByTxId.set(t.id, "LOYALTY");
      }
    } else {
      nonMemberOmset += total;
      nonMemberOrders += 1;
      segmentByTxId.set(t.id, "NON_MEMBER");
    }

    for (const item of t.items) {
      const lineTotal = Number(item.unitPrice) * item.qty;
      const entry = byProduct.get(item.productId) ?? { name: item.product.name, omset: 0, qty: 0, byChannel: new Map() };
      entry.omset += lineTotal;
      entry.qty += item.qty;
      const channelEntry = entry.byChannel.get(t.channel) ?? { qty: 0, omset: 0 };
      channelEntry.qty += item.qty;
      channelEntry.omset += lineTotal;
      entry.byChannel.set(t.channel, channelEntry);
      byProduct.set(item.productId, entry);

      if (PRODUK_PELENGKAP_NAMES.has(item.product.name)) {
        porsiPelengkap += item.qty;
      } else if (item.product.category === "ALACARTE") {
        porsiAlacarte += item.qty;
      } else {
        // Everything else is a PAKET_* category (Online/MBG/Kopdes/Pahlawan).
        porsiPaket += item.qty;
      }
      for (const tp of item.toppings) {
        porsiTopping += tp.qty;
      }
    }
  }

  return {
    byChannel: Array.from(byChannel.entries())
      .map(([channel, stat]) => ({ channel, ...withAov(stat) }))
      .sort((a, b) => b.omset - a.omset),
    byCustomerModel: Array.from(byCustomerModel.entries())
      .map(([model, stat]) => ({ model, ...withAov(stat) }))
      .sort((a, b) => b.omset - a.omset),
    byPaymentModel: Array.from(byPaymentModel.entries())
      .map(([model, stat]) => ({ model, ...withAov(stat) }))
      .sort((a, b) => b.omset - a.omset),
    customerModelGroups: groupChannelsByModel(byChannel, CUSTOMER_MODEL_CHANNELS),
    paymentModelGroups: groupChannelsByModel(byChannel, PAYMENT_MODEL_CHANNELS),
    // "Terbanyak" for a member means most frequent, not highest-spending —
    // orders is the ranking key (ties broken by omset).
    byMember: Array.from(byMember.entries())
      .map(([memberId, stat]) => ({ memberId, ...withAov(stat) }))
      .sort((a, b) => b.orders - a.orders || b.omset - a.omset),
    // "Terbanyak" for a product means best-seller by units, not revenue —
    // qty is the ranking key (ties broken by omset).
    byProduct: Array.from(byProduct.entries())
      .map(([productId, entry]) => ({
        productId,
        name: entry.name,
        omset: entry.omset,
        qty: entry.qty,
        aov: entry.qty > 0 ? entry.omset / entry.qty : 0,
        channels: Array.from(entry.byChannel.entries())
          .map(([channel, c]) => ({ channel, ...c }))
          .sort((a, b) => b.omset - a.omset),
      }))
      .sort((a, b) => b.qty - a.qty || b.omset - a.omset),
    byPeriod: Array.from(byPeriod.entries())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([, entry]) => entry),
    transactions: transactions.map((t) => ({
      id: t.id,
      time: t.createdAt,
      channel: t.channel,
      subtotal: Number(t.subtotal),
      discount: Number(t.discount),
      total: Number(t.total),
      itemCount: t.items.reduce((sum, i) => sum + i.qty, 0),
      itemsSummary: t.items.map((i) => `${i.product.name} ×${i.qty}`).join(", "),
      kasirName: resolveKasirName(t.pramuniagaId, t.createdAt, t.pramuniaga.name, attendance),
      outletName: t.outlet.name,
      memberId: t.memberId,
      memberName: t.member?.name ?? null,
      segment: segmentByTxId.get(t.id) ?? "NON_MEMBER",
      items: t.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        productName: i.product.name,
        qty: i.qty,
        unitPrice: Number(i.unitPrice),
        toppings: i.toppings.map((tp) => ({
          toppingId: tp.toppingId,
          toppingName: tp.topping.name,
          qty: tp.qty,
          unitPrice: Number(tp.unitPrice),
        })),
      })),
    })),
    summary: withAov({
      omset: transactions.reduce((sum, t) => sum + Number(t.total), 0),
      orders: transactions.length,
    }),
    porsi: {
      total: porsiAlacarte + porsiPaket + porsiPelengkap + porsiTopping,
      alacarte: porsiAlacarte,
      paket: porsiPaket,
      produkPelengkap: porsiPelengkap,
      topping: porsiTopping,
    },
    memberSegments: {
      loyalty: { ...withAov({ omset: loyaltyOmset, orders: loyaltyOrders }), activeMembers: loyaltyMemberIds.size },
      nonMember: withAov({ omset: nonMemberOmset, orders: nonMemberOrders }),
      newRegister: withAov({ omset: newRegisterOmset, orders: newRegisterOrders }),
    },
  };
}
