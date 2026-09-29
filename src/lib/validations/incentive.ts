import { z } from "zod";

const INCENTIVE_TYPES = [
  "PRAMU", "SPV", "PENGELOLA", "OFFICER_SALES", "HEAD_SALES",
  "OFFICER_MARKETING", "HEAD_MARKETING", "HEAD_FA", "HEAD_OPERASIONAL", "MANAGEMENT", "ROYALTY",
] as const;
const INCENTIVE_BASES = ["PERSEN_OMSET", "PERSEN_LABA_KOTOR", "PERSEN_LABA_BERSIH", "NOMINAL_TETAP"] as const;

export const incentiveRuleUpdateSchema = z.object({
  type: z.enum(INCENTIVE_TYPES),
  basis: z.enum(INCENTIVE_BASES),
  rate: z.number().min(0),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const investorSchema = z.object({
  name: z.string().min(1).max(200),
  ownershipPct: z.number().min(0).max(100),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  note: z.string().max(500).optional(),
});

export const sharingProfitRuleSchema = z.object({
  rate: z.number().min(0).max(100),
});

const OUTLET_PURCHASE_CATEGORIES = ["BAHAN", "BAHAN_EKSTERNAL", "BAHAN_PENDUKUNG", "SAYUR", "GAS", "ANGKUT", "POTONGAN", "LAINNYA"] as const;

export const outletPurchaseSchema = z.object({
  outletId: z.string().uuid(),
  date: z.coerce.date(),
  description: z.string().min(1).max(300),
  qty: z.number().positive(),
  unit: z.string().min(1).max(20).optional(),
  amount: z.number().positive(),
  note: z.string().max(500).optional(),
  category: z.enum(OUTLET_PURCHASE_CATEGORIES).optional(),
  materialId: z.string().uuid().optional(),
});

export const runCalculationSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
});

// ── Adjustment Sheet — Barang Rusak / Barang Reject / Barang Selisih ──────
const OUTLET_ADJUSTMENT_TYPES = ["RUSAK", "REJECT", "SELISIH", "KELUAR"] as const;

export const outletAdjustmentSchema = z.object({
  outletId: z.string().uuid(),
  date: z.coerce.date(),
  type: z.enum(OUTLET_ADJUSTMENT_TYPES),
  materialId: z.string().uuid().optional(),
  description: z.string().min(1).max(300),
  qty: z.number().min(0),
  amount: z.number().min(0),
  note: z.string().max(500).optional(),
});

// ── OutletMaterial — the "Data Stock Available" catalog (admin master data) ──
const OUTLET_MATERIAL_CATEGORIES = ["BAHAN_UTAMA", "BAHAN_BAKU_TAMBAHAN", "PACKAGING", "BAHAN_ALAT_PENDUKUNG"] as const;

export const outletMaterialSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(200),
  category: z.enum(OUTLET_MATERIAL_CATEGORIES),
  unit: z.string().min(1).max(20),
  unitPrice: z.number().min(0),
  sortOrder: z.number().int().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const updateOutletMaterialSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  category: z.enum(OUTLET_MATERIAL_CATEGORIES).optional(),
  unit: z.string().min(1).max(20).optional(),
  unitPrice: z.number().min(0).optional(),
  sortOrder: z.number().int().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const outletMaterialClosingBalanceSchema = z.object({
  outletId: z.string().uuid(),
  materialId: z.string().uuid(),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  qty: z.number().min(0),
  note: z.string().max(500).optional(),
});

// ── IncentiveBracket — the tiered Absen+Insentive rate table (admin master data) ──
export const incentiveBracketSchema = z.object({
  label: z.string().min(1).max(100),
  rangeMin: z.number().min(0),
  rangeMax: z.number().min(0).optional(),
  rateSinglePic: z.number().min(0).max(100),
  rateMultiPic: z.number().min(0).max(100),
  sortOrder: z.number().int().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const updateIncentiveBracketSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  rangeMin: z.number().min(0).optional(),
  rangeMax: z.number().min(0).nullable().optional(),
  rateSinglePic: z.number().min(0).max(100).optional(),
  rateMultiPic: z.number().min(0).max(100).optional(),
  sortOrder: z.number().int().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});
