import { z } from "zod";

export const createPramuniagaRosterSchema = z.object({
  name: z.string().min(1),
});

export const updatePramuniagaRosterSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional(),
});
