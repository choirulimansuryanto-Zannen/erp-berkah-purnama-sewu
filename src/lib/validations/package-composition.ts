import { z } from "zod";

export const packageCompositionSchema = z.object({
  components: z.array(
    z.object({
      componentProductId: z.string().uuid().optional(),
      componentToppingId: z.string().uuid().optional(),
      qty: z.number().int().min(1),
    }),
  ),
});
