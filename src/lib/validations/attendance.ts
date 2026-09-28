import { z } from "zod";

export const checkInSchema = z.object({
  gps: z.string().min(1).optional(),
  // Accepts a webcam-captured data: URI as well as a real URL — no object
  // storage is wired up yet, so the selfie is stored inline.
  photoUrl: z.string().min(1).optional(),
  pramuniagaRosterId: z.string().uuid(),
  shift: z.enum(["SHIFT_1", "SHIFT_2", "FULLSHIFT"]),
});

export const checkOutSchema = z.object({
  gps: z.string().min(1).optional(),
  pramuniagaRosterId: z.string().uuid(),
});

export const checkpointSchema = z.object({
  // Upper bound is generous since the checkpoint count is policy-driven
  // (see src/lib/policy.ts) rather than a fixed 23; server does not know
  // the caller's effective policy at validation time.
  checkpointNumber: z.number().int().min(1).max(96),
  status: z.string().min(1),
  notes: z.string().optional(),
  photoUrl: z.string().url().optional(),
  locationGps: z.string().optional(),
});

export const leaveRequestSchema = z.object({
  type: z.enum(["OFF", "SAKIT", "ANNUAL", "PERSONAL", "BEREAVEMENT", "UNPAID"]),
  dateFrom: z.coerce.date(),
  dateTo: z.coerce.date(),
  reason: z.string().min(1),
  attachmentUrl: z.string().url().optional(),
});
