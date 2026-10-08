import { z } from "zod";

export const createVendorSchema = z.object({
  name: z.string().min(1),
});

export const updateVendorSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional(),
});

export const createVendorLedgerEntrySchema = z.object({
  vendorId: z.string().min(1),
  date: z.string().min(1),
  hutang: z.number().min(0).default(0),
  bayar: z.number().min(0).default(0),
  remarks: z.string().optional(),
});

export const createReceivableEntrySchema = z.object({
  date: z.string().min(1),
  mitraCode: z.string().min(1),
  mitraName: z.string().min(1),
  noFaktur: z.string().optional(),
  tglFaktur: z.string().optional(),
  description: z.string().min(1),
  debt: z.number().min(0).default(0),
  credit: z.number().min(0).default(0),
  remarks: z.string().optional(),
  group: z.enum(["OUTLET", "MITRA", "SAYUR", "KOBAR", "MANGKACAU", "TORTILLA", "MIE_STEAK"]),
});
