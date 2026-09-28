import { z } from "zod";

export const submitChecklistSchema = z.object({
  // Which checked-in pramuniaga this checklist belongs to — each person on
  // shift keeps their own, not one merged per outlet.
  pramuniagaRosterId: z.string().uuid(),
  items: z
    .array(
      z.object({
        itemId: z.string().uuid(),
        // Webcam-captured data: URI or a manually uploaded file's data: URI —
        // no object storage is wired up, so photos are stored inline.
        photoUrl: z.string().min(1),
      }),
    )
    .min(1),
});
