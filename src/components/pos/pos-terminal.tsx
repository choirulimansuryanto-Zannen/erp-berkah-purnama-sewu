"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Bike,
  CreditCard,
  Minus,
  Music2,
  Plus,
  Receipt,
  ShoppingBag,
  Sparkles,
  Sprout,
  Tag,
  Trash2,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { isChannelAllowedForCategory } from "@/lib/channel-rules";
import { Button } from "@/components/ui/button";
import { MemberPanel, type SelectedMember, type VoucherReward } from "@/components/pos/member-panel";

type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  // Present only for paket products — what the package physically contains
  // (e.g. Kopdes 1 = 1x Kebab Jumbo + 1x Kebab Cheesy Black + 1x Extra Keju),
  // informational display only, doesn't affect pricing or the cart total.
  composition?: { name: string; qty: number }[];
};

type Topping = {
  id: string;
  name: string;
  price: number;
};

type CartToppingLine = { topping: Topping; qty: number };
type CartLine = {
  id: string;
  product: Product;
  qty: number;
  toppings: CartToppingLine[];
  // Set only on a free line added via voucher redemption — see checkout().
  voucherRedemptionId?: string;
};

const CATEGORIES = ["ALACARTE", "PAKET_ONLINE", "PAKET_MBG", "PAKET_KOPDES", "PAKET_PAHLAWAN"] as const;

const CHANNELS = [
  { value: "CASH", label: "Cash", icon: Wallet, color: "bg-emerald-600" },
  { value: "CASHLESS", label: "Cashless", icon: CreditCard, color: "bg-blue-600" },
  { value: "GRAB", label: "GrabFood", icon: Bike, color: "bg-teal-600" },
  { value: "GOFOOD", label: "GoFood", icon: Sprout, color: "bg-green-600" },
  { value: "SHOPEE", label: "ShopeeFood", icon: ShoppingBag, color: "bg-orange-500" },
  { value: "QPON", label: "Qpon", icon: Tag, color: "bg-violet-600" },
  { value: "TIKTOK", label: "TikTok", icon: Music2, color: "bg-slate-900" },
] as const;

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

function lineTotal(line: CartLine) {
  if (line.voucherRedemptionId) return 0; // voucher reward — free, no topping charge
  const toppingsPerUnit = line.toppings.reduce((s, t) => s + t.topping.price * t.qty, 0);
  return (line.product.price + toppingsPerUnit) * line.qty;
}

export function PosTerminal({
  products,
  toppings,
  outletName,
  cashierName,
  channelRules,
}: {
  products: Product[];
  toppings: Topping[];
  outletName?: string;
  cashierName?: string;
  channelRules: { category: string; allowedChannels: string[] }[];
}) {
  const [activeCategory, setActiveCategory] = useState<(typeof CATEGORIES)[number]>("ALACARTE");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]["value"]>("CASH");
  // The cart line that topping taps apply to — set to whichever product line
  // was just added, so tapping a menu item and then a topping both land in
  // the keranjang immediately with no separate "staging" step in between.
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [member, setMember] = useState<SelectedMember | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const visibleProducts = products.filter(
    (p) => p.category === activeCategory && isChannelAllowedForCategory(p.category, channel, channelRules),
  );
  const categoryBlockedForChannel = products.some((p) => p.category === activeCategory) && visibleProducts.length === 0;
  const subtotal = useMemo(() => cart.reduce((sum, line) => sum + lineTotal(line), 0), [cart]);
  const itemCount = cart.reduce((sum, l) => sum + l.qty, 0);
  const activeLine = cart.find((l) => l.id === activeLineId) ?? null;
  const canEditToppings = Boolean(activeLine) && !activeLine?.voucherRedemptionId;
  const activeToppingsCount = activeLine?.toppings.reduce((s, t) => s + t.qty, 0) ?? 0;

  // Applies directly to the active cart line — no intermediate "staged"
  // state, so a topping tap is reflected in the keranjang immediately, same
  // as a product tap. New toppings are appended at the end of the line's
  // toppings array (only on the 0→1 transition) so the order shown always
  // matches the order they were first tapped in.
  function adjustLineTopping(lineId: string, topping: Topping, delta: number) {
    setCart((prev) =>
      prev.map((line) => {
        if (line.id !== lineId) return line;
        const idx = line.toppings.findIndex((t) => t.topping.id === topping.id);
        if (idx === -1) {
          if (delta <= 0) return line;
          return { ...line, toppings: [...line.toppings, { topping, qty: delta }] };
        }
        const nextQty = line.toppings[idx].qty + delta;
        const nextToppings =
          nextQty <= 0
            ? line.toppings.filter((_, i) => i !== idx)
            : line.toppings.map((t, i) => (i === idx ? { ...t, qty: nextQty } : t));
        return { ...line, toppings: nextToppings };
      }),
    );
  }

  function addToCart(product: Product) {
    // Tapping the same bare (no-topping) product again just stacks the qty;
    // once a line has toppings on it, a further tap starts a new line, since
    // it's now a distinct variant.
    const existingBare = cart.find((l) => l.product.id === product.id && l.toppings.length === 0 && !l.voucherRedemptionId);
    if (existingBare) {
      setCart((prev) => prev.map((l) => (l.id === existingBare.id ? { ...l, qty: l.qty + 1 } : l)));
      setActiveLineId(existingBare.id);
      return;
    }
    const newLine: CartLine = { id: crypto.randomUUID(), product, qty: 1, toppings: [] };
    setCart((prev) => [...prev, newLine]);
    setActiveLineId(newLine.id);
  }

  // A voucher reward is added as its own line — never merged into an
  // existing paid line of the same product, since that would either zero
  // out the price of paid units or (the other way round) charge for the
  // free one. Placed via crypto.randomUUID() like every other addToCart
  // call, so it lands at the end of the cart in the order it was claimed.
  // Deliberately does NOT become the active line — voucher rewards don't
  // take toppings, so the topping panel keeps targeting the last paid item.
  function handleVoucherRedeemed(reward: VoucherReward) {
    setCart((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        product: { id: reward.productId, name: reward.productName, category: "", price: reward.price },
        qty: reward.qty,
        toppings: [],
        voucherRedemptionId: reward.redemptionId,
      },
    ]);
  }

  function updateQty(lineId: string, qty: number) {
    setCart((prev) =>
      qty <= 0 ? prev.filter((l) => l.id !== lineId) : prev.map((l) => (l.id === lineId ? { ...l, qty } : l)),
    );
    if (qty <= 0 && lineId === activeLineId) setActiveLineId(null);
  }

  function checkout() {
    startTransition(async () => {
      setResult(null);
      const res = await fetch("/api/pos/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((l) => ({
            productId: l.product.id,
            qty: l.qty,
            toppings: l.toppings.map((t) => ({ toppingId: t.topping.id, qty: t.qty })),
            voucherRedemptionId: l.voucherRedemptionId,
          })),
          channel,
          paymentMethod: channel,
          memberId: member?.member_id,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ ok: true, message: `Transaksi berhasil disimpan.` });
        setCart([]);
        setActiveLineId(null);
        setMember(null);
      } else {
        setResult({ ok: false, message: typeof data.error === "string" ? data.error : "Gagal membuat transaksi." });
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* ── LEFT: channel, categories, member search, menu grid ────────── */}
      <div className="lg:col-span-2">
        <div className="rounded-xl border border-slate-200/70 bg-white p-4 shadow-[var(--shadow-card)]">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-accent-500" />
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Channel Penjualan</p>
            <span className="ml-auto text-[11px] text-slate-400">Pilih channel order</span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {CHANNELS.map((c) => {
              const Icon = c.icon;
              const active = channel === c.value;
              return (
                <button
                  key={c.value}
                  onClick={() => setChannel(c.value)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-xs font-semibold text-white shadow-sm transition-transform",
                    c.color,
                    active ? "ring-2 ring-amber-400 ring-offset-2 scale-[1.03]" : "opacity-80 hover:opacity-100",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {c.label.toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                activeCategory === cat
                  ? "bg-brand-900 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300",
              )}
            >
              {cat.replace("_", " ")}
            </button>
          ))}
        </div>

        <div className="mt-3">
          <MemberPanel
            member={member}
            onMemberChange={setMember}
            onVoucherRedeemed={handleVoucherRedeemed}
            outletName={outletName}
          />
        </div>

        {categoryBlockedForChannel && (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
            Kategori {activeCategory.replace("_", " ")} tidak berlaku untuk channel{" "}
            {CHANNELS.find((c) => c.value === channel)?.label ?? channel} saat ini.
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {visibleProducts.map((product) => (
            <button
              key={product.id}
              onClick={() => addToCart(product)}
              className="group rounded-xl border border-slate-200/70 bg-white p-3 text-left shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-accent-300 hover:shadow-[var(--shadow-card-hover)]"
            >
              <span className="mb-1.5 inline-block rounded bg-brand-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {product.category.replace("_", " ")}
              </span>
              <div className="flex aspect-square items-center justify-center rounded-lg bg-slate-50 text-slate-300">
                <UtensilsCrossed className="h-9 w-9" />
              </div>
              <p className="mt-2 truncate text-sm font-medium text-slate-900">{product.name}</p>
              {product.composition && product.composition.length > 0 && (
                <p
                  className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-400"
                  title={`Isi: ${product.composition.map((c) => `${c.qty}x ${c.name}`).join(", ")}`}
                >
                  {product.composition.map((c) => `${c.qty}x ${c.name}`).join(", ")}
                </p>
              )}
              <div className="mt-1 flex items-center justify-between">
                <p className="text-sm font-semibold text-accent-700">{currency.format(product.price)}</p>
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition-colors group-hover:bg-accent-100 group-hover:text-accent-700">
                  <Plus className="h-3.5 w-3.5" />
                </span>
              </div>
            </button>
          ))}
          {visibleProducts.length === 0 && !categoryBlockedForChannel && (
            <p className="col-span-full rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
              Tidak ada produk di kategori ini.
            </p>
          )}
        </div>
      </div>

      {/* ── RIGHT: topping → cart → receipt mockup, stacked ─────────────── */}
      <div className="flex flex-col gap-4 lg:sticky lg:top-6 lg:h-fit">
        {/* Topping */}
        <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2 bg-brand-900 px-4 py-2.5">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">Topping</p>
              {activeLine && (
                <p className="truncate text-[11px] text-white/70">untuk {activeLine.product.name}</p>
              )}
            </div>
            {activeToppingsCount > 0 && (
              <span className="ml-auto rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-semibold text-brand-900">
                {activeToppingsCount} dipilih
              </span>
            )}
          </div>
          <div className="max-h-56 divide-y divide-slate-100 overflow-y-auto">
            {toppings.map((t) => {
              const qty = activeLine?.toppings.find((x) => x.topping.id === t.id)?.qty ?? 0;
              return (
                <div key={t.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{t.name}</p>
                    <p className="text-xs text-slate-400">{currency.format(t.price)}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => activeLine && adjustLineTopping(activeLine.id, t, -1)}
                      disabled={!canEditToppings || qty === 0}
                      className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-5 text-center text-sm font-medium">{qty}</span>
                    <button
                      onClick={() => activeLine && adjustLineTopping(activeLine.id, t, 1)}
                      disabled={!canEditToppings}
                      className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
            {toppings.length === 0 && (
              <p className="px-4 py-6 text-center text-xs text-slate-400">Belum ada topping aktif.</p>
            )}
          </div>
          {toppings.length > 0 && (
            <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
              {activeLine
                ? "Topping langsung ditambahkan ke item terakhir di keranjang."
                : "Tap produk dulu, lalu pilih topping untuk item tersebut."}
            </p>
          )}
        </div>

        {/* Cart */}
        <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2 bg-emerald-600 px-4 py-2.5">
            <ShoppingBag className="h-4 w-4 text-white" />
            <p className="text-sm font-semibold text-white">Keranjang Pesanan</p>
            {itemCount > 0 && (
              <span className="ml-auto rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium text-white">
                {itemCount} item
              </span>
            )}
          </div>

          <div className="p-4">
            <ul className="divide-y divide-slate-100">
              {cart.map((line) => (
                <li
                  key={line.id}
                  className={cn(
                    "py-2.5 text-sm",
                    line.id === activeLineId && "-mx-2 rounded-lg bg-accent-50/60 px-2 ring-1 ring-inset ring-accent-200",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => !line.voucherRedemptionId && setActiveLineId(line.id)}
                      disabled={Boolean(line.voucherRedemptionId)}
                      className="min-w-0 text-left disabled:cursor-default"
                      title={line.voucherRedemptionId ? undefined : "Pilih untuk atur topping item ini"}
                    >
                      <p className="flex items-center gap-1.5 truncate font-medium text-slate-800">
                        {line.product.name}
                        {line.voucherRedemptionId && (
                          <span className="shrink-0 rounded-full bg-gold-100 px-1.5 py-0.5 text-[10px] font-semibold text-gold-800">
                            VOUCHER
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400">
                        {line.voucherRedemptionId ? "Gratis" : currency.format(line.product.price)}
                      </p>
                    </button>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateQty(line.id, line.qty - 1)}
                        className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-5 text-center text-sm font-medium">{line.qty}</span>
                      <button
                        onClick={() => updateQty(line.id, line.qty + 1)}
                        className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => updateQty(line.id, 0)}
                        className="ml-1 flex h-6 w-6 items-center justify-center rounded-md text-slate-300 hover:bg-rose-50 hover:text-rose-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {line.toppings.length > 0 && (
                    <ul className="mt-1 space-y-0.5 pl-1">
                      {line.toppings.map((t) => (
                        <li key={t.topping.id} className="flex items-center justify-between text-xs text-slate-500">
                          <span>
                            + {t.topping.name} × {t.qty}
                          </span>
                          <span>{currency.format(t.topping.price * t.qty)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {line.product.composition && line.product.composition.length > 0 && (
                    <p className="mt-1 pl-1 text-[11px] italic text-slate-400">
                      Isi: {line.product.composition.map((c) => `${c.qty}x ${c.name}`).join(", ")}
                    </p>
                  )}
                </li>
              ))}
              {cart.length === 0 && <li className="py-8 text-center text-sm text-slate-400">Keranjang masih kosong.</li>}
            </ul>

            <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-3 text-sm font-semibold text-brand-900">
              <span>Total</span>
              <span>{currency.format(subtotal)}</span>
            </div>

            <Button onClick={checkout} disabled={cart.length === 0 || pending} className="mt-4 w-full" size="lg">
              {pending ? "Memproses..." : "Bayar & Simpan"}
            </Button>

            {result && (
              <p className={cn("mt-2 text-center text-xs font-medium", result.ok ? "text-emerald-600" : "text-rose-600")}>
                {result.message}
              </p>
            )}
          </div>
        </div>

        {/* Receipt mockup */}
        <ReceiptPreview
          outletName={outletName}
          cashierName={cashierName}
          channel={CHANNELS.find((c) => c.value === channel)?.label ?? channel}
          cart={cart}
          subtotal={subtotal}
          member={member}
        />
      </div>
    </div>
  );
}

function ReceiptPreview({
  outletName,
  cashierName,
  channel,
  cart,
  subtotal,
  member,
}: {
  outletName?: string;
  cashierName?: string;
  channel: string;
  cart: CartLine[];
  subtotal: number;
  member: { name: string; tier: string; points: number } | null;
}) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2 bg-slate-100 px-4 py-2.5">
        <Receipt className="h-4 w-4 text-slate-500" />
        <p className="text-sm font-semibold text-slate-700">Mockup Struk Transaksi</p>
      </div>
      <div className="bg-slate-50 p-4">
        <div className="mx-auto max-w-[280px] rounded-md border border-dashed border-slate-300 bg-white px-4 py-4 font-mono text-[11px] leading-relaxed text-slate-700">
          <div className="text-center">
            <p className="text-sm font-bold tracking-wide">{outletName ?? "OUTLET"}</p>
            <p className="text-slate-500">PT Berkah Purnama Sewu</p>
          </div>
          <div className="my-2 border-t border-dashed border-slate-300" />
          <div className="flex justify-between">
            <span>{dateStr}</span>
            <span>{timeStr}</span>
          </div>
          <div className="flex justify-between">
            <span>Kasir</span>
            <span>{cashierName ?? "-"}</span>
          </div>
          <div className="flex justify-between">
            <span>Channel</span>
            <span>{channel}</span>
          </div>
          {member && (
            <div className="flex justify-between">
              <span>Member</span>
              <span className="truncate">{member.name}</span>
            </div>
          )}
          <div className="my-2 border-t border-dashed border-slate-300" />
          {cart.length === 0 ? (
            <p className="py-3 text-center text-slate-400">Belum ada item.</p>
          ) : (
            <div className="space-y-1.5">
              {cart.map((line) => (
                <div key={line.id}>
                  <div className="flex justify-between">
                    <span className="truncate pr-2">
                      {line.product.name} × {line.qty}
                    </span>
                    <span className="shrink-0">{currency.format(line.product.price * line.qty)}</span>
                  </div>
                  {line.toppings.map((t) => (
                    <div key={t.topping.id} className="flex justify-between pl-2 text-slate-500">
                      <span className="truncate pr-2">
                        + {t.topping.name} × {t.qty}
                      </span>
                      <span className="shrink-0">{currency.format(t.topping.price * t.qty)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          <div className="my-2 border-t border-dashed border-slate-300" />
          <div className="flex justify-between text-sm font-bold">
            <span>TOTAL</span>
            <span>{currency.format(subtotal)}</span>
          </div>
          <div className="my-2 border-t border-dashed border-slate-300" />
          <p className="text-center text-slate-500">Terima kasih atas kunjungan Anda</p>
        </div>
      </div>
    </div>
  );
}
