import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Channel, type ProductCategory } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { DEMO_PASSWORD, DEMO_USERS } from "../src/lib/demo-accounts";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Real Sales-division org structure + outlet names as supplied by the
// business (2026-08-07). Outlet headcount/shift coverage is no longer a
// static capacity field — it's derived dynamically from how many active
// PRAMUNIAGA users have `outletId` set and which `shift` each one covers
// (see the Shift enum + User.shift in schema.prisma), so an outlet can be
// staffed by 1+ pramuniaga across Shift 1 / Shift 2 / Fullshift as assigned
// via /admin/users — this seed just creates the outlets themselves.
const REGION_SEED = [
  {
    name: "Region Cilegon",
    outlets: [
      "PANJAITAN", "PCI", "WARINGIN KURUNG", "KERAMAT WATU", "SUNAN AMPEL",
      "PIRANHA", "METRO CILEGON", "KALITIMBANG", "ARGA BAJA", "BBS", "WARINGIN DEPAN",
    ],
  },
  {
    name: "Region Karawaci",
    outlets: ["HARKIT", "PAM", "SANGIANG", "SHOLEH ALI", "KERONCONG", "BINONG", "BONANG", "MEDANG", "REGENCY", "PAWON"],
  },
  {
    name: "Region Serang",
    outlets: [
      "JAMAKSARI", "JAYADININGRAT", "BANTEN LAMA", "CIWARU", "EMPAT LIMA",
      "LINGKAR SELATAN", "TAMAN CIRUAS", "MAYABON", "UNIBA", "PAKUPATAN",
    ],
  },
  {
    name: "Region Ciledug",
    outlets: ["PORTAL", "KARANG TENGAH", "SOETOMO", "GOPLI", "PD KACANG", "JELUPANG", "SWADAYA", "MUCHTAR 2", "TAJUR", "CILEDUG INDAH"],
  },
  {
    name: "Region Jakbar",
    outlets: ["PORIS", "CITRA GARDEN", "TSI"],
  },
  {
    name: "Region Balaraja",
    outlets: ["SAGA", "CIKANDE", "BKT GADING", "PASAR CISOKA", "SUDIRMAN"],
  },
  {
    name: "Region Tangsel-Ponji",
    outlets: ["PONDOK RANJI", "CEGER", "BINTARO PERMAI", "BINTARO 9", "ANGGREK LOKA", "KENCANA LOKA", "VERSAILLES"],
  },
  {
    name: "Region Bekasi-Cikarang",
    outlets: ["KALIABANG", "M TABRANI", "PURI CENDANA", "SIMPANG LIMA", "CIFEST", "BCM", "GRAHA PRIMA"],
  },
] as const;
// 11+10+10+10+3+5+7+7 = 63 outlets — matches prd.md "63 outlets" company-wide.

// Real menu supplied by the business (2026-08-07). `cost` (HPP) was not
// provided in the source — set equal to `price` as an explicit placeholder
// (visibly 0% margin) rather than a fabricated figure; update real HPP at
// /admin/products.
// "Beef Patty"/"Chilimeat"/"Cheese"/"Sosis" removed from the menu per
// stakeholder request (2026-08-07) — were standalone Alacarte items in the
// original spreadsheet, no longer sold that way.
const ALACARTE = [
  ["Kebab Small", 13000], ["Kebab Medium", 15000], ["Kebab Super", 17000], ["Kebab Jumbo", 19000],
  ["Kebab Cheesy Black", 19000], ["Shawarma", 17000], ["American Hotdog", 17000], ["Mexican Hotdog", 17000],
  ["Clasic Beef Burger", 20000], ["Air Mineral Prima", 4000], ["Teh Botol Sosro", 7000], ["Fruit Tea", 7000],
] as const;
const PAKET_ONLINE = [
  ["Trio Super Cheese", 72000], ["Trio Super Chilimeat", 72000], ["Trio Super Supreme", 74000],
  ["Trio Jumbo Cheese", 78000], ["Trio Jumbo Chilimeat", 78000], ["Trio Jumbo Supreme", 80000],
  ["Mampir 1", 33000], ["Mampir 2", 33000], ["Mampir 3", 30000], ["Mampir 4", 30000],
] as const;
const KOPDES = [
  ["Kopdes 1", 42000], ["Kopdes 2", 47000], ["Kopdes 3", 47000], ["Kopdes 4", 47000],
  ["Kopdes 5", 42000], ["Kopdes 6", 47000], ["Kopdes 7", 47000], ["Kopdes 8", 47000],
  ["Kopdes 9", 44000], ["Kopdes 10", 51000], ["Kopdes 11", 51000], ["Kopdes 12", 51000],
] as const;
const MBG = [
  ["MBG 1", 66000], ["MBG 2", 71000], ["MBG 3", 71000], ["MBG 4", 71000],
  ["MBG 5", 66000], ["MBG 6", 71000], ["MBG 7", 71000], ["MBG 8", 71000],
  ["MBG 9", 70000], ["MBG 10", 77000], ["MBG 11", 77000], ["MBG 12", 77000],
] as const;
const PAHLAWAN = [["Pahlawan", 57000]] as const;

// Name-based, NOT positional — a real bug (2026-08-07) surfaced when 4 items
// were removed from the middle of ALACARTE: positional SKUs (`AC-${index}`)
// shifted for every item after the removed ones, so upsert-by-sku created
// duplicate new rows instead of updating the originals and orphaned the old
// rows (one of which had a real transaction attached). Slugging the name
// keeps a product's SKU — and therefore its row identity — stable no matter
// where it sits in the array or how many items are added/removed around it.
function skuFor(prefix: string, name: string) {
  return `${prefix}-${name.toUpperCase().replace(/[^A-Z0-9]+/g, "")}`;
}

// Prefixes deliberately distinct from the earlier placeholder SKUs
// (ALC-001/002, MBG-001, KOPDES-001, PAHLAWAN-001) — reusing those caused a
// real bug on the first run of this seed: the upsert-by-sku matched the old
// placeholder rows and silently overwrote their price while keeping the old
// name, and "Pahlawan" (PAHLAWAN-001) never got created as its own row.
// sortOrder mirrors the "No." column of the business's menu spreadsheet
// (per-category, 1-indexed) — display order, not a business rule. Listing
// products alphabetically instead scrambles e.g. Kebab Small/Medium/Super/
// Jumbo into Cheesy Black/Jumbo/Medium/Small/Super.
const PRODUCT_SEED = [
  ...ALACARTE.map(([name, price], i) => ({ sku: skuFor("AC", name), name, category: "ALACARTE" as const, price, cost: price, sortOrder: i + 1 })),
  ...PAKET_ONLINE.map(([name, price], i) => ({ sku: skuFor("PO", name), name, category: "PAKET_ONLINE" as const, price, cost: price, sortOrder: i + 1 })),
  ...KOPDES.map(([name, price], i) => ({ sku: skuFor("KD", name), name, category: "PAKET_KOPDES" as const, price, cost: price, sortOrder: i + 1 })),
  ...MBG.map(([name, price], i) => ({ sku: skuFor("MB", name), name, category: "PAKET_MBG" as const, price, cost: price, sortOrder: i + 1 })),
  ...PAHLAWAN.map(([name, price], i) => ({ sku: skuFor("PH", name), name, category: "PAKET_PAHLAWAN" as const, price, cost: price, sortOrder: i + 1 })),
];

// Starter toppings — only the ones visible in the reference POS mockup the
// business supplied (2026-08-07); more can be added at /admin/toppings.
const TOPPING_SEED = [
  { name: "Extra Beef", price: 9000 },
  { name: "Extra Chilimeat", price: 7000 },
  { name: "Extra Keju", price: 7000 },
  { name: "Extra Sosis", price: 7000 },
];

// Real pramuniaga roster as supplied by the business (2026-08-10) — the
// names selectable at check-in, distinct from login accounts. More can be
// added at /admin/pramuniaga-roster.
const PRAMUNIAGA_ROSTER_SEED = [
  "Muhammad Syekhnal Akbar", "Muhammad Dafif Alhanan", "Iklas Permadi", "Achmad Nurrochman", "Mukhlis",
  "Arul", "Tubagus Ipank Riki Ardhani", "Ahyadi Khoirul Anam", "Muhamad Akhpas Apriansyah", "Muhammad Teja",
  "Saripudin", "Muhamad Syahdan Akbar", "Randi", "M. Nur Said", "Rahmat Setiaji",
  "Saeful Ma'arif", "Alaraz Wari Setiawan", "Ade Saputra", "Satrio Wibowo", "Muhammad Zainul Bahri",
  "Imam Setyawan", "Arif Angga", "Muhammad Yandra Hersandy", "Yoga Saputra", "Asep Wirana",
  "Haviz Zendiago", "Muhammad Ridho Sulamaa", "Faiz Farizka", "Pangestu Tjandra Hadiansyah", "Arizal Abdillah",
  "TB. Ahmad Rifai", "Wildanis", "Muhammad Rifky", "Adi Wiganda", "Alga Prasetya",
  "Agum Gumilar", "Syadad Nabiil Mudzzaffar", "Muhammad Kurniawan", "Muhamad Fuad Firmansyah", "Ary Ilfar",
  "Khalifatul Muzakkar", "Fahmi Afanudin", "Angga Juni Saputra", "Risman Mulyana", "Azka Mufdanil",
  "Abdul Aziz (Pramu)", "Elin Adiyanto", "Wandi", "Rico Fajar Van Gama", "Rizqi Umami",
  "Fajri Riyadi", "Virdan Afrizal", "Muhamad Sidik Efendi", "Apandi Asgar", "Alfi Lucky Muhammad",
  "Taupik Wahyudin", "Adam Ramadhani", "Sulaeman", "Rizky Tarunanegara", "Ahmad Hafiz Ilfani Rahman",
  "Rois Fadilah", "Muhammad Irfandi", "Faisal Wanda", "Firzatulloh Cahya Putra", "Shandika Permana",
  "Aji", "Dio Irawan Putra", "Adriansyah", "Ahmad Zaedi Alwrist",
];

// Daily operational checklist as supplied by the business (2026-08-10) —
// SOP tasks documented with a photo during the shift. One fixed catalog
// shared by every outlet; sortOrder mirrors the mockup's row order.
const CHECKLIST_SEED: { category: string; subLabel: string }[] = [
  { category: "Screenshoot Aplikasi Online", subLabel: "Grab" },
  { category: "Screenshoot Aplikasi Online", subLabel: "Go" },
  { category: "Screenshoot Aplikasi Online", subLabel: "Shopee" },
  { category: "Barang Pendukung Outlet", subLabel: "In" },
  { category: "Barang Pendukung Outlet", subLabel: "Out" },
  { category: "Screen Shoot Point of Sales System", subLabel: "Shift 1" },
  { category: "Screen Shoot Point of Sales System", subLabel: "Shift 2" },
  { category: "Cuci Peralatan Outlet — Setiap Hari", subLabel: "Kaca" },
  { category: "Cuci Peralatan Outlet — Setiap Hari", subLabel: "Saos Keju" },
  { category: "Cuci Peralatan Outlet — Setiap Hari", subLabel: "Cuci Lap" },
  { category: "Cuci Peralatan Outlet — Per 7 Hari", subLabel: "Saos Sambal" },
  { category: "Cuci Peralatan Outlet — Per 7 Hari", subLabel: "Saos Tomat" },
  { category: "Cuci Peralatan Outlet — Per 7 Hari", subLabel: "Mayonaise" },
  { category: "Prepare Stock", subLabel: "" },
  { category: "Cuci Muka 1 (16.00)", subLabel: "" },
  { category: "Cuci Muka 2 (18.30)", subLabel: "" },
  { category: "Screenshoot Daftar Menu (21.00)", subLabel: "Grab" },
  { category: "Screenshoot Daftar Menu (21.00)", subLabel: "Go" },
  { category: "Screenshoot Daftar Menu (21.00)", subLabel: "Shopee" },
  { category: "Seragam", subLabel: "Jam 10.00" },
  { category: "Seragam", subLabel: "Jam 16.00" },
  { category: "Seragam", subLabel: "Jam 18.00" },
  { category: "Rekapitulasi Membership", subLabel: "Jam 19.00" },
  { category: "Rekapitulasi Membership", subLabel: "Jam 21.00" },
  { category: "Rekapitulasi Membership", subLabel: "Jam 23.00" },
];

// Placeholder products from earlier seed rounds — retired (not deleted, to
// keep any historical transactions referencing them intact).
const LEGACY_DEMO_PRODUCTS = [
  { sku: "ALC-001", name: "Nasi Ayam Geprek", price: 18000, cost: 9000 },
  { sku: "ALC-002", name: "Es Teh Manis", price: 5000, cost: 1500 },
  { sku: "MBG-001", name: "Paket MBG Hemat", price: 15000, cost: 8000 },
  { sku: "KOPDES-001", name: "Paket KOPDES Komplit", price: 22000, cost: 11000 },
  { sku: "PAHLAWAN-001", name: "Paket PAHLAWAN Spesial", price: 25000, cost: 13000 },
];

async function upsertAuthUser(email: string, name: string) {
  const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
  const found = existing.users.find((u) => u.email === email);
  if (found) return found.id;

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error || !data.user) throw new Error(`Failed to create auth user ${email}: ${error?.message}`);
  return data.user.id;
}

function regionShortName(regionName: string) {
  return regionName.replace(/^Region /, "");
}

/** Renames outlets created by the earlier generic "Outlet {Region} {NN}" seed round to their real names, by position. */
async function migrateGenericOutletNames(regionShortNameStr: string, regionId: string, realNames: readonly string[]) {
  for (let i = 0; i < realNames.length; i++) {
    const num = String(i + 1).padStart(2, "0");
    const oldName = `Outlet ${regionShortNameStr} ${num}`;
    const newName = realNames[i];
    const existing = await prisma.outlet.findFirst({ where: { name: oldName, regionId } });
    if (existing && existing.name !== newName) {
      await prisma.outlet.update({ where: { id: existing.id }, data: { name: newName } });
    }
  }
}

async function main() {
  const outletsBySlug = new Map<string, { id: string }>();

  for (const r of REGION_SEED) {
    const region =
      (await prisma.region.findFirst({ where: { name: r.name } })) ??
      (await prisma.region.create({ data: { name: r.name } }));

    await migrateGenericOutletNames(regionShortName(r.name), region.id, r.outlets);

    for (let i = 0; i < r.outlets.length; i++) {
      const name = r.outlets[i];

      const outlet =
        (await prisma.outlet.findFirst({ where: { name, regionId: region.id } })) ??
        (await prisma.outlet.create({ data: { name, regionId: region.id } }));

      if (r.name === "Region Cilegon" && i === 0) outletsBySlug.set("cilegon-01", outlet);
    }
  }

  for (const p of PRODUCT_SEED) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: { price: p.price, cost: p.cost, sortOrder: p.sortOrder },
      create: p,
    });
  }
  // Restore + retire the placeholder rows (a prior seed run, before the SKU
  // prefixes above were fixed, corrupted these by upserting new prices onto
  // the old names — see the LEGACY_DEMO_PRODUCTS comment).
  for (const legacy of LEGACY_DEMO_PRODUCTS) {
    // sortOrder 999 sinks these below the real menu in /admin/products —
    // they're INACTIVE and excluded from POS/customer-facing lists entirely,
    // this just keeps the admin list from showing retired items first.
    await prisma.product.updateMany({
      where: { sku: legacy.sku },
      data: { name: legacy.name, price: legacy.price, cost: legacy.cost, status: "INACTIVE", sortOrder: 999 },
    });
  }

  for (const t of TOPPING_SEED) {
    const existing = await prisma.topping.findFirst({ where: { name: t.name } });
    if (existing) {
      await prisma.topping.update({ where: { id: existing.id }, data: { price: t.price } });
    } else {
      await prisma.topping.create({ data: t });
    }
  }

  for (const name of PRAMUNIAGA_ROSTER_SEED) {
    const existing = await prisma.pramuniagaRoster.findFirst({ where: { name } });
    if (!existing) {
      await prisma.pramuniagaRoster.create({ data: { name } });
    }
  }

  for (let i = 0; i < CHECKLIST_SEED.length; i++) {
    const { category, subLabel } = CHECKLIST_SEED[i];
    const existing = await prisma.operationalChecklistItem.findFirst({ where: { category, subLabel } });
    if (!existing) {
      await prisma.operationalChecklistItem.create({ data: { category, subLabel, sortOrder: i + 1 } });
    } else if (existing.sortOrder !== i + 1) {
      await prisma.operationalChecklistItem.update({ where: { id: existing.id }, data: { sortOrder: i + 1 } });
    }
  }

  const cilegon01 = outletsBySlug.get("cilegon-01");
  const userIdByRole = new Map<string, string>();
  let cilegonSpvId: string | null = null;

  for (const demo of DEMO_USERS) {
    const userId = await upsertAuthUser(demo.email, demo.name);
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: demo.email,
        name: demo.name,
        role: demo.role,
        outletId: demo.outlet === "cilegon-01" ? cilegon01?.id : undefined,
      },
    });
    if (demo.role === "SPV") cilegonSpvId = userId;
    userIdByRole.set(demo.role, userId);
  }

  if (cilegonSpvId) {
    const cilegonRegion = await prisma.region.findFirst({ where: { name: "Region Cilegon" } });
    if (cilegonRegion) await prisma.region.update({ where: { id: cilegonRegion.id }, data: { spvId: cilegonSpvId } });
  }

  // Warehouse demo data (Ops Admin module) — receiving + resulting stock/min level.
  const opsAdminId = userIdByRole.get("OPS_ADMIN");
  if (opsAdminId) {
    const products = await prisma.product.findMany({ where: { status: "ACTIVE" } });
    for (const p of products) {
      const existingStock = await prisma.warehouseStock.findUnique({ where: { productId: p.id } });
      if (existingStock) continue;
      const qty = 100;
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 45);
      await prisma.warehouseReceiving.create({
        data: { productId: p.id, qty, lotNumber: "SEED-LOT-1", expiryDate: expiry, supplierName: "Supplier Demo", receivedById: opsAdminId },
      });
      await prisma.warehouseStock.upsert({
        where: { productId: p.id },
        create: { productId: p.id, qtyOnHand: qty, minLevel: 20 },
        update: {},
      });
    }
  }

  // Marketing demo campaign.
  const marketingAdminId = userIdByRole.get("MARKETING_ADMIN");
  if (marketingAdminId) {
    const existingCampaign = await prisma.campaign.findFirst({ where: { name: "Weekend Bonus Poin" } });
    if (!existingCampaign) {
      const start = new Date();
      const end = new Date();
      end.setDate(end.getDate() + 14);
      await prisma.campaign.create({
        data: {
          name: "Weekend Bonus Poin",
          description: "Bonus 2x poin untuk member Silver & Gold setiap akhir pekan.",
          startDate: start,
          endDate: end,
          targetTier: "SILVER",
          bonusMultiplier: 2,
          status: "ACTIVE",
          createdById: marketingAdminId,
        },
      });
    }
  }

  // HRGA default attendance policy as an explicit row (not just the code fallback).
  const hrgaAdminId = userIdByRole.get("HRGA_ADMIN");
  const existingPolicy = await prisma.attendancePolicy.findFirst();
  if (!existingPolicy && hrgaAdminId) {
    await prisma.attendancePolicy.create({
      data: {
        checkpointStartHour: 9,
        checkpointEndHour: 20,
        checkpointIntervalMinutes: 30,
        gracePeriodMinutes: 15,
        annualLeaveDays: 12,
        sickLeaveDays: 12,
        personalLeaveDays: 3,
        updatedById: hrgaAdminId,
      },
    });
  }

  // Company-wide business rules as an explicit row (not just the code
  // fallback) — mirrors DEFAULT_BUSINESS_SETTINGS in src/lib/business-settings.ts.
  const masterAdminId = userIdByRole.get("MASTER_ADMIN");
  const existingBusinessSettings = await prisma.businessSettings.findFirst();
  if (!existingBusinessSettings && masterAdminId) {
    await prisma.businessSettings.create({
      data: {
        expenseAutoApproveLimit: 500000,
        posDiscountSpvThresholdPercent: 10,
        voidWindowMinutes: 30,
        cashVarianceAutoApprove: 10000,
        cashVarianceSpvReview: 50000,
        memberAnnualSpendWindowDays: 365,
        loyaltySilverThreshold: 500000,
        loyaltyGoldThreshold: 2000000,
        loyaltyBronzeMultiplier: 1,
        loyaltySilverMultiplier: 1.2,
        loyaltyGoldMultiplier: 1.5,
        loyaltyPointsPerRupiah: 1,
        loyaltyRupiahPerPointRedeemed: 100,
        stockUnitTolerance: 5,
        stockPercentTolerance: 5,
        inventoryEscalationUnits: 10,
        expiryWarningDays: 30,
        businessHourStart: 9,
        businessHourEnd: 21,
        pacingRedThresholdPercent: 70,
        pacingYellowThresholdPercent: 90,
        updatedById: masterAdminId,
      },
    });
  }

  // Which channels each restricted product category is allowed to sell
  // through, per stakeholder spec (2026-08-11) — admin-editable afterward
  // at /admin/channel-rules, this just seeds the initial rules. A category
  // with no row here has no restriction (ALACARTE, PAKET_MBG).
  const CHANNEL_RULE_SEED: { category: ProductCategory; allowedChannels: Channel[] }[] = [
    { category: "PAKET_ONLINE", allowedChannels: ["GRAB", "GOFOOD", "SHOPEE"] },
    { category: "PAKET_KOPDES", allowedChannels: ["CASH", "CASHLESS", "QPON", "TIKTOK"] },
    { category: "PAKET_PAHLAWAN", allowedChannels: ["GRAB", "GOFOOD", "SHOPEE"] },
  ];
  if (masterAdminId) {
    for (const rule of CHANNEL_RULE_SEED) {
      const existing = await prisma.categoryChannelRule.findUnique({ where: { category: rule.category } });
      if (!existing) {
        await prisma.categoryChannelRule.create({
          data: { category: rule.category, allowedChannels: rule.allowedChannels, updatedById: masterAdminId },
        });
      }
    }
  }

  // Raw materials tracked on the Daily Report's stock reconciliation
  // section (2026-08-11) — outlet-supplied list, matched by name so re-runs
  // stay idempotent.
  const RAW_MATERIAL_SEED: { name: string; unit: string; group: "DAGING" | "SAYUR" | "SAOS_KEMASAN"; sortOrder: number }[] = [
    { name: "Ketul @2kg", unit: "Ketul", group: "DAGING", sortOrder: 1 },
    { name: "Ketul @4kg", unit: "Ketul", group: "DAGING", sortOrder: 2 },
    { name: "Lettuce", unit: "Kg", group: "SAYUR", sortOrder: 1 },
    { name: "Sawi Putih", unit: "Kg", group: "SAYUR", sortOrder: 2 },
    { name: "Mayonaise", unit: "Pack", group: "SAOS_KEMASAN", sortOrder: 1 },
    { name: "Saos Sambal", unit: "Pack", group: "SAOS_KEMASAN", sortOrder: 2 },
    { name: "Saos Tomat", unit: "Pack", group: "SAOS_KEMASAN", sortOrder: 3 },
    { name: "Saos Keju", unit: "Pack", group: "SAOS_KEMASAN", sortOrder: 4 },
    { name: "Mentega", unit: "Pack", group: "SAOS_KEMASAN", sortOrder: 5 },
    { name: "Kemasan Medium", unit: "Pack", group: "SAOS_KEMASAN", sortOrder: 6 },
    { name: "Kemasan Large", unit: "Pack", group: "SAOS_KEMASAN", sortOrder: 7 },
    { name: "Kemasan Roti Johny", unit: "Pack", group: "SAOS_KEMASAN", sortOrder: 8 },
    { name: "Plastik Kebab Alibaba", unit: "Pack", group: "SAOS_KEMASAN", sortOrder: 9 },
    { name: "Box Burger", unit: "Pack", group: "SAOS_KEMASAN", sortOrder: 10 },
    { name: "Kertas Roti", unit: "Pack", group: "SAOS_KEMASAN", sortOrder: 11 },
  ];
  for (const m of RAW_MATERIAL_SEED) {
    const existing = await prisma.rawMaterial.findFirst({ where: { name: m.name } });
    if (!existing) {
      await prisma.rawMaterial.create({ data: m });
    }
  }

  // Stock Freezer's own catalog (2026-08-26, outlet-supplied "Nama Barang
  // (Urutan list nya Statis)" sheet) — a separate list from RAW_MATERIAL_SEED
  // above even where names overlap (Mayonaise, Saos Sambal, ...), so this
  // feature never perturbs the already-shipped Daily Report material tables.
  // sortOrder mirrors the sheet's own row order (its own note: "statis").
  const FREEZER_MATERIAL_SEED: { name: string; unit: string; sortOrder: number }[] = [
    { name: "Daging @4kg", unit: "Ketul", sortOrder: 1 },
    { name: "daging @2kg", unit: "Ketul", sortOrder: 2 },
    { name: "Beef Patty", unit: "Pcs", sortOrder: 3 },
    { name: "Sosis Nidia", unit: "Pcs", sortOrder: 4 },
    { name: "Labanise Small", unit: "Pcs", sortOrder: 5 },
    { name: "Labanise Medium", unit: "Pcs", sortOrder: 6 },
    { name: "Labanise Super", unit: "Pcs", sortOrder: 7 },
    { name: "Labanise Jumbo", unit: "Pcs", sortOrder: 8 },
    { name: "Labanise Black Medium", unit: "Pcs", sortOrder: 9 },
    { name: "Roti Hotdog", unit: "Pcs", sortOrder: 10 },
    { name: "Burger Bun", unit: "Pcs", sortOrder: 11 },
    { name: "Chilimeat", unit: "Pcs", sortOrder: 12 },
    { name: "Cheese", unit: "Pcs", sortOrder: 13 },
    { name: "Air Mineral Prima", unit: "Botol", sortOrder: 14 },
    { name: "The Botol Sosro", unit: "Botol", sortOrder: 15 },
    { name: "Fruit Tea", unit: "Botol", sortOrder: 16 },
    { name: "Mayonaise", unit: "Pack", sortOrder: 17 },
    { name: "Saos Sambal", unit: "Pack", sortOrder: 18 },
    { name: "Saos Tomat", unit: "Pack", sortOrder: 19 },
    { name: "Saos Keju", unit: "Pack", sortOrder: 20 },
    { name: "Mentega", unit: "Pack", sortOrder: 21 },
    { name: "Kemasan MEDIUM", unit: "Pack", sortOrder: 22 },
    { name: "Kemasan LARGE", unit: "Pack", sortOrder: 23 },
    { name: "Kemasan Roti Jhony", unit: "Pack", sortOrder: 24 },
    { name: "Plastik Kebab Alibaba", unit: "Pack", sortOrder: 25 },
    { name: "Box Burger", unit: "Ball", sortOrder: 26 },
    { name: "Kertas Roti", unit: "Rim", sortOrder: 27 },
  ];
  for (const m of FREEZER_MATERIAL_SEED) {
    const existing = await prisma.freezerMaterial.findFirst({ where: { name: m.name } });
    if (!existing) {
      await prisma.freezerMaterial.create({ data: m });
    }
  }

  // Master-admin-editable Expense categories (2026-08-12) — replaces what
  // was previously a fixed enum. Matched by `key` so re-runs stay
  // idempotent; admin edits at /admin/expense-categories after this point
  // are the source of truth, this only seeds the initial list.
  const EXPENSE_CATEGORY_SEED: { key: string; label: string; sortOrder: number }[] = [
    { key: "SAYUR", label: "Sayur", sortOrder: 1 },
    { key: "MENTEGA", label: "Mentega", sortOrder: 2 },
    { key: "GAS_3KG", label: "Gas 3kg", sortOrder: 3 },
    { key: "BENSIN", label: "Bensin", sortOrder: 4 },
    { key: "SUNLIGHT", label: "Sunlight", sortOrder: 5 },
    { key: "TISSUE", label: "Tissue", sortOrder: 6 },
    { key: "GLOVE", label: "Glove", sortOrder: 7 },
    { key: "KERTAS_ROTI", label: "Kertas Roti", sortOrder: 8 },
    { key: "KEJU_SLICE", label: "Keju Slice", sortOrder: 9 },
    { key: "FOTOCOPY", label: "Fotocopy", sortOrder: 10 },
    { key: "ALAT_TULIS", label: "Alat Tulis", sortOrder: 11 },
    { key: "PAKET_DATA", label: "Paket Data", sortOrder: 12 },
    { key: "IURAN_OUTLET", label: "Iuran Outlet", sortOrder: 13 },
    { key: "IURAN_MESS", label: "Iuran Mess", sortOrder: 14 },
    { key: "TOKEN_LISTRIK_MESS", label: "Token Listrik Mess", sortOrder: 15 },
    { key: "TOKEN_LISTRIK_OUTLET", label: "Token Listrik Outlet", sortOrder: 16 },
    { key: "SERVICE_MOTOR", label: "Service Motor", sortOrder: 17 },
    { key: "PERALATAN_OUTLET", label: "Peralatan Outlet", sortOrder: 18 },
    { key: "PERBAIKAN_OUTLET", label: "Perbaikan Outlet", sortOrder: 19 },
    { key: "SEWA_TENANT", label: "Sewa Tenant", sortOrder: 20 },
    { key: "SEWA_MESS", label: "Sewa Mess", sortOrder: 21 },
    { key: "ISI_ULANG_GALON", label: "Isi Ulang Galon", sortOrder: 22 },
    { key: "PLASTIK", label: "Plastik", sortOrder: 23 },
    { key: "PLASTIK_SAMPAH", label: "Plastik Sampah", sortOrder: 24 },
    { key: "MINUMAN", label: "Minuman", sortOrder: 25 },
    { key: "LAIN_LAIN", label: "Lain-lain", sortOrder: 26 },
  ];
  for (const c of EXPENSE_CATEGORY_SEED) {
    const existing = await prisma.expenseCategoryDef.findUnique({ where: { key: c.key } });
    if (!existing) {
      await prisma.expenseCategoryDef.create({ data: { ...c, updatedById: masterAdminId } });
    }
  }

  // What each paket Product physically contains (2026-08-12, outlet-supplied
  // recipe sheet) — "Cheese"/"Chilimeat"/"Beef Patty" map to the Topping rows
  // Extra Keju/Extra Chilimeat/Extra Beef (same raw-ingredient-name alias
  // used on the Daily Report stock table). Matched by package name so
  // re-runs stay idempotent; skips a package entirely once it already has
  // any PackageComponent rows (admin edits at /admin/package-composition
  // after this point are the source of truth).
  const TOPPING_ALIAS: Record<string, string> = {
    Cheese: "Extra Keju",
    Chilimeat: "Extra Chilimeat",
    "Beef Patty": "Extra Beef",
    Sosis: "Extra Sosis",
  };
  const PACKAGE_ALIAS: Record<string, string> = {
    "Trio Kebab Super Cheese": "Trio Super Cheese",
    "Trio Kebab Super Chilimeat": "Trio Super Chilimeat",
    "Trio Kebab Super Supreme": "Trio Super Supreme",
    "Trio Kebab Jumbo Cheese": "Trio Jumbo Cheese",
    "Trio Kebab Jumbo Chilimeat": "Trio Jumbo Chilimeat",
    "Trio Kebab Jumbo Supreme": "Trio Jumbo Supreme",
  };
  type PackageComponentSpec = { name: string; kind: "PRODUCT" | "TOPPING"; qty: number };
  const PACKAGE_COMPONENT_SEED: { packageName: string; components: PackageComponentSpec[] }[] = [
    { packageName: "Kopdes 1", components: [{ name: "Kebab Jumbo", kind: "PRODUCT", qty: 1 }, { name: "Kebab Cheesy Black", kind: "PRODUCT", qty: 1 }, { name: "Cheese", kind: "TOPPING", qty: 1 }] },
    { packageName: "Kopdes 2", components: [{ name: "Kebab Jumbo", kind: "PRODUCT", qty: 1 }, { name: "Shawarma", kind: "PRODUCT", qty: 1 }, { name: "Cheese", kind: "TOPPING", qty: 2 }] },
    { packageName: "Kopdes 3", components: [{ name: "Kebab Jumbo", kind: "PRODUCT", qty: 1 }, { name: "American Hotdog", kind: "PRODUCT", qty: 1 }, { name: "Cheese", kind: "TOPPING", qty: 2 }] },
    { packageName: "Kopdes 4", components: [{ name: "Kebab Jumbo", kind: "PRODUCT", qty: 1 }, { name: "Mexican Hotdog", kind: "PRODUCT", qty: 1 }, { name: "Cheese", kind: "TOPPING", qty: 2 }] },
    { packageName: "Kopdes 5", components: [{ name: "Kebab Jumbo", kind: "PRODUCT", qty: 1 }, { name: "Kebab Cheesy Black", kind: "PRODUCT", qty: 1 }, { name: "Chilimeat", kind: "TOPPING", qty: 1 }] },
    { packageName: "Kopdes 6", components: [{ name: "Kebab Jumbo", kind: "PRODUCT", qty: 1 }, { name: "Shawarma", kind: "PRODUCT", qty: 1 }, { name: "Chilimeat", kind: "TOPPING", qty: 2 }] },
    { packageName: "Kopdes 7", components: [{ name: "Kebab Jumbo", kind: "PRODUCT", qty: 1 }, { name: "American Hotdog", kind: "PRODUCT", qty: 1 }, { name: "Chilimeat", kind: "TOPPING", qty: 2 }] },
    { packageName: "Kopdes 8", components: [{ name: "Kebab Jumbo", kind: "PRODUCT", qty: 1 }, { name: "Mexican Hotdog", kind: "PRODUCT", qty: 1 }, { name: "Chilimeat", kind: "TOPPING", qty: 2 }] },
    { packageName: "Kopdes 9", components: [{ name: "Kebab Jumbo", kind: "PRODUCT", qty: 1 }, { name: "Kebab Cheesy Black", kind: "PRODUCT", qty: 1 }, { name: "Beef Patty", kind: "TOPPING", qty: 1 }] },
    { packageName: "Kopdes 10", components: [{ name: "Kebab Jumbo", kind: "PRODUCT", qty: 1 }, { name: "Shawarma", kind: "PRODUCT", qty: 1 }, { name: "Beef Patty", kind: "TOPPING", qty: 2 }] },
    { packageName: "Kopdes 11", components: [{ name: "Kebab Jumbo", kind: "PRODUCT", qty: 1 }, { name: "American Hotdog", kind: "PRODUCT", qty: 1 }, { name: "Beef Patty", kind: "TOPPING", qty: 2 }] },
    { packageName: "Kopdes 12", components: [{ name: "Kebab Jumbo", kind: "PRODUCT", qty: 1 }, { name: "Mexican Hotdog", kind: "PRODUCT", qty: 1 }, { name: "Beef Patty", kind: "TOPPING", qty: 2 }] },
    { packageName: "MBG 1", components: [{ name: "Kebab Jumbo", kind: "PRODUCT", qty: 2 }, { name: "Kebab Cheesy Black", kind: "PRODUCT", qty: 1 }, { name: "Cheese", kind: "TOPPING", qty: 2 }] },
    { packageName: "MBG 2", components: [{ name: "Kebab Jumbo", kind: "PRODUCT", qty: 2 }, { name: "Shawarma", kind: "PRODUCT", qty: 1 }, { name: "Cheese", kind: "TOPPING", qty: 2 }] },
    { packageName: "MBG 3", components: [{ name: "Kebab Jumbo", kind: "PRODUCT", qty: 2 }, { name: "American Hotdog", kind: "PRODUCT", qty: 1 }, { name: "Cheese", kind: "TOPPING", qty: 2 }] },
    { packageName: "MBG 4", components: [{ name: "Kebab Jumbo", kind: "PRODUCT", qty: 2 }, { name: "Mexican Hotdog", kind: "PRODUCT", qty: 1 }, { name: "Cheese", kind: "TOPPING", qty: 2 }] },
    { packageName: "MBG 5", components: [{ name: "Kebab Jumbo", kind: "PRODUCT", qty: 2 }, { name: "Kebab Cheesy Black", kind: "PRODUCT", qty: 1 }, { name: "Chilimeat", kind: "TOPPING", qty: 2 }] },
    { packageName: "MBG 6", components: [{ name: "Kebab Jumbo", kind: "PRODUCT", qty: 2 }, { name: "Shawarma", kind: "PRODUCT", qty: 1 }, { name: "Chilimeat", kind: "TOPPING", qty: 2 }] },
    { packageName: "MBG 7", components: [{ name: "Kebab Jumbo", kind: "PRODUCT", qty: 2 }, { name: "American Hotdog", kind: "PRODUCT", qty: 1 }, { name: "Chilimeat", kind: "TOPPING", qty: 2 }] },
    { packageName: "MBG 8", components: [{ name: "Kebab Jumbo", kind: "PRODUCT", qty: 2 }, { name: "Mexican Hotdog", kind: "PRODUCT", qty: 1 }, { name: "Chilimeat", kind: "TOPPING", qty: 2 }] },
    { packageName: "MBG 9", components: [{ name: "Kebab Jumbo", kind: "PRODUCT", qty: 2 }, { name: "Kebab Cheesy Black", kind: "PRODUCT", qty: 1 }, { name: "Beef Patty", kind: "TOPPING", qty: 1 }] },
    { packageName: "MBG 10", components: [{ name: "Kebab Jumbo", kind: "PRODUCT", qty: 2 }, { name: "Shawarma", kind: "PRODUCT", qty: 1 }, { name: "Beef Patty", kind: "TOPPING", qty: 2 }] },
    { packageName: "MBG 11", components: [{ name: "Kebab Jumbo", kind: "PRODUCT", qty: 2 }, { name: "American Hotdog", kind: "PRODUCT", qty: 1 }, { name: "Beef Patty", kind: "TOPPING", qty: 2 }] },
    { packageName: "MBG 12", components: [{ name: "Kebab Jumbo", kind: "PRODUCT", qty: 2 }, { name: "Mexican Hotdog", kind: "PRODUCT", qty: 1 }, { name: "Beef Patty", kind: "TOPPING", qty: 2 }] },
    { packageName: "Trio Kebab Super Cheese", components: [{ name: "Kebab Super", kind: "PRODUCT", qty: 3 }, { name: "Cheese", kind: "TOPPING", qty: 3 }] },
    { packageName: "Trio Kebab Super Chilimeat", components: [{ name: "Kebab Super", kind: "PRODUCT", qty: 3 }, { name: "Chilimeat", kind: "TOPPING", qty: 3 }] },
    { packageName: "Trio Kebab Super Supreme", components: [{ name: "Kebab Super", kind: "PRODUCT", qty: 3 }, { name: "Beef Patty", kind: "TOPPING", qty: 3 }] },
    { packageName: "Trio Kebab Jumbo Cheese", components: [{ name: "Kebab Jumbo", kind: "PRODUCT", qty: 3 }, { name: "Cheese", kind: "TOPPING", qty: 3 }] },
    { packageName: "Trio Kebab Jumbo Chilimeat", components: [{ name: "Kebab Jumbo", kind: "PRODUCT", qty: 3 }, { name: "Chilimeat", kind: "TOPPING", qty: 3 }] },
    { packageName: "Trio Kebab Jumbo Supreme", components: [{ name: "Kebab Jumbo", kind: "PRODUCT", qty: 3 }, { name: "Beef Patty", kind: "TOPPING", qty: 3 }] },
    { packageName: "Mampir 1", components: [{ name: "Kebab Jumbo", kind: "PRODUCT", qty: 1 }, { name: "Chilimeat", kind: "TOPPING", qty: 1 }, { name: "Teh Botol Sosro", kind: "PRODUCT", qty: 1 }] },
    { packageName: "Mampir 2", components: [{ name: "Kebab Jumbo", kind: "PRODUCT", qty: 1 }, { name: "Cheese", kind: "TOPPING", qty: 1 }, { name: "Teh Botol Sosro", kind: "PRODUCT", qty: 1 }] },
    { packageName: "Mampir 3", components: [{ name: "Kebab Jumbo", kind: "PRODUCT", qty: 1 }, { name: "Chilimeat", kind: "TOPPING", qty: 1 }, { name: "Air Mineral Prima", kind: "PRODUCT", qty: 1 }] },
    { packageName: "Mampir 4", components: [{ name: "Kebab Jumbo", kind: "PRODUCT", qty: 1 }, { name: "Cheese", kind: "TOPPING", qty: 1 }, { name: "Air Mineral Prima", kind: "PRODUCT", qty: 1 }] },
    { packageName: "Pahlawan", components: [{ name: "Kebab Jumbo", kind: "PRODUCT", qty: 3 }] },
  ];
  {
    const allProducts = await prisma.product.findMany({ where: { status: "ACTIVE" } });
    const allToppings = await prisma.topping.findMany({ where: { status: "ACTIVE" } });
    const productByName = new Map(allProducts.map((p) => [p.name, p]));
    const toppingByName = new Map(allToppings.map((t) => [t.name, t]));

    for (const spec of PACKAGE_COMPONENT_SEED) {
      const packageProduct = productByName.get(PACKAGE_ALIAS[spec.packageName] ?? spec.packageName);
      if (!packageProduct) continue;
      const existing = await prisma.packageComponent.findFirst({ where: { packageProductId: packageProduct.id } });
      if (existing) continue;

      for (let i = 0; i < spec.components.length; i++) {
        const c = spec.components[i];
        if (c.kind === "PRODUCT") {
          const p = productByName.get(c.name);
          if (!p) continue;
          await prisma.packageComponent.create({
            data: { packageProductId: packageProduct.id, componentProductId: p.id, qty: c.qty, sortOrder: i },
          });
        } else {
          const t = toppingByName.get(TOPPING_ALIAS[c.name] ?? c.name);
          if (!t) continue;
          await prisma.packageComponent.create({
            data: { packageProductId: packageProduct.id, componentToppingId: t.id, qty: c.qty, sortOrder: i },
          });
        }
      }
    }
  }

  const totalOutlets = await prisma.outlet.count();
  const totalRegions = await prisma.region.count();
  const totalProducts = await prisma.product.count({ where: { status: "ACTIVE" } });
  const totalRoster = await prisma.pramuniagaRoster.count({ where: { status: "ACTIVE" } });

  console.log(
    `Seed complete: ${totalRegions} regions, ${totalOutlets} outlets, ${totalProducts} active menu items, ${totalRoster} pramuniaga roster.`,
  );
  console.log(`Password for all demo accounts: ${DEMO_PASSWORD}\n`);
  console.log("Role".padEnd(18), "Email");
  console.log("-".repeat(60));
  for (const demo of DEMO_USERS) {
    console.log(demo.role.padEnd(18), demo.email);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
