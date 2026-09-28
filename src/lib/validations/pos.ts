import { z } from "zod";

export const createTransactionSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        qty: z.number().int().min(1),
        toppings: z
          .array(
            z.object({
              toppingId: z.string().uuid(),
              qty: z.number().int().min(1),
            }),
          )
          .optional()
          .default([]),
        // Present only on a free line added via voucher redemption — the
        // server re-verifies this against VoucherRedemption rather than
        // trusting a client-supplied price (see /api/pos/transactions).
        voucherRedemptionId: z.string().uuid().optional(),
      }),
    )
    .min(1),
  discount: z.number().min(0).default(0),
  channel: z.enum(["CASH", "CASHLESS", "GRAB", "GOFOOD", "SHOPEE", "QPON", "TIKTOK"]),
  paymentMethod: z.string().min(1),
  memberId: z.string().uuid().optional(),
  pointsToRedeem: z.number().int().min(0).default(0),
  deviceFingerprint: z.string().optional(),
  notes: z.string().optional(),
  // Required when manual discount exceeds 10% of subtotal (SPV approval).
  approvedBySpvId: z.string().uuid().optional(),
});

export const voidTransactionSchema = z.object({
  reason: z.string().min(1),
  approvalSpvId: z.string().uuid(),
});

// "Editing" a completed transaction is implemented as void-the-original +
// create-a-corrected-transaction (src/app/api/pos/transactions/[id]/edit) —
// same reason/approver shape as a void, plus the corrected order details.
export const editTransactionSchema = voidTransactionSchema.extend({
  items: createTransactionSchema.shape.items,
  discount: createTransactionSchema.shape.discount,
  channel: createTransactionSchema.shape.channel,
  paymentMethod: createTransactionSchema.shape.paymentMethod,
  memberId: createTransactionSchema.shape.memberId,
  pointsToRedeem: createTransactionSchema.shape.pointsToRedeem,
});
