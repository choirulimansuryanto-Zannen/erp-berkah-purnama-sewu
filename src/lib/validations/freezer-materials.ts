import { z } from "zod";

export const createFreezerMaterialSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  sortOrder: z.number().int().min(0).default(0),
  minStock: z.number().int().min(0).default(10),
});

export const updateFreezerMaterialSchema = z.object({
  name: z.string().min(1).optional(),
  unit: z.string().min(1).optional(),
  sortOrder: z.number().int().min(0).optional(),
  minStock: z.number().int().min(0).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "SEASONAL"]).optional(),
});
