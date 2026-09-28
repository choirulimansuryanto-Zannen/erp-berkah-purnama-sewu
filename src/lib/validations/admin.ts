import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["PRAMUNIAGA", "SPV", "OFFICE", "OPS_ADMIN", "FA_ADMIN", "HRGA_ADMIN", "MARKETING_ADMIN", "MASTER_ADMIN"]),
  outletId: z.string().uuid().optional(),
  // Meaningful for PRAMUNIAGA only — which shift they cover at their outlet.
  shift: z.enum(["SHIFT_1", "SHIFT_2", "FULLSHIFT"]).optional(),
  phone: z.string().optional(),
  tempPassword: z.string().min(8),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["PRAMUNIAGA", "SPV", "OFFICE", "OPS_ADMIN", "FA_ADMIN", "HRGA_ADMIN", "MARKETING_ADMIN", "MASTER_ADMIN"]).optional(),
  outletId: z.string().uuid().nullable().optional(),
  shift: z.enum(["SHIFT_1", "SHIFT_2", "FULLSHIFT"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional(),
});
