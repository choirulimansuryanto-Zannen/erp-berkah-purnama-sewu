import { z } from "zod";

export const createToppingSchema = z.object({
  name: z.string().min(1),
  price: z.number().min(0),
});

export const updateToppingSchema = z.object({
  name: z.string().min(1).optional(),
  price: z.number().min(0).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "SEASONAL"]).optional(),
});
