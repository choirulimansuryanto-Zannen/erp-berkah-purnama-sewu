import { z } from "zod";

export const createFixedAssetSchema = z.object({
  category: z.enum(["BANGUNAN_KANTOR", "PERALATAN_KANTOR", "BANGUNAN_PABRIK", "PERALATAN_PABRIK", "KENDARAAN"]),
  description: z.string().min(1),
  acquisitionAmount: z.number().min(0),
  depreciableBase: z.number().min(0),
  usefulLifeMonths: z.number().int().min(1),
  acquisitionDate: z.string().min(1),
  remark: z.string().optional(),
});

export const updateFixedAssetSchema = z.object({
  status: z.enum(["ACTIVE", "DISPOSED"]).optional(),
  remark: z.string().optional(),
});
