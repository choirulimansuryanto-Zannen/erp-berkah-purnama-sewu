import { z } from "zod";

export const registerMemberSchema = z.object({
  phone: z.string().min(8).max(20),
  name: z.string().min(1),
  birthDate: z.coerce.date().optional(),
  city: z.string().min(1).optional(),
});
