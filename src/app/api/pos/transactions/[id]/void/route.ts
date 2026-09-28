import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { voidTransactionSchema } from "@/lib/validations/pos";
import { getBusinessSettings } from "@/lib/business-settings";

// Refund/void policy per prd.md §2.5: within N minutes (admin-editable at
// /admin/settings), SPV approval, auto point reversal, tracked as a
// reversal transaction rather than a mutation of the original (immutability
// principle, prd.md §"Key Design Principles").

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, response } = await requirePermission("pos:void_transaction");
  if (!user) return response!;

  const parsed = voidTransactionSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const approver = await prisma.user.findUnique({ where: { id: parsed.data.approvalSpvId } });
  if (!approver || !["SPV", "MASTER_ADMIN"].includes(approver.role)) {
    return NextResponse.json({ error: "approvalSpvId must reference an SPV or Master Admin" }, { status: 400 });
  }

  const original = await prisma.transaction.findUnique({ where: { id }, include: { items: true } });
  if (!original) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  if (original.status === "VOIDED") {
    return NextResponse.json({ error: "Transaction already voided" }, { status: 409 });
  }

  const settings = await getBusinessSettings();
  const minutesSinceCreation = (Date.now() - original.createdAt.getTime()) / 1000 / 60;
  if (minutesSinceCreation > settings.voidWindowMinutes) {
    return NextResponse.json({ error: `Void window (${settings.voidWindowMinutes} minutes) has expired` }, { status: 400 });
  }

  const reversal = await prisma.$transaction(async (tx) => {
    await tx.transaction.update({
      where: { id: original.id },
      data: { status: "VOIDED", voidReason: parsed.data.reason, voidApprovedById: approver.id },
    });

    if (original.memberId) {
      await tx.member.update({
        where: { id: original.memberId },
        data: {
          pointsBalance: { increment: original.pointsRedeemed - original.pointsEarned },
        },
      });
    }

    return tx.transaction.create({
      data: {
        outletId: original.outletId,
        pramuniagaId: original.pramuniagaId,
        memberId: original.memberId,
        subtotal: original.subtotal.negated(),
        discount: original.discount.negated(),
        tax: original.tax.negated(),
        total: original.total.negated(),
        channel: original.channel,
        paymentMethod: original.paymentMethod,
        status: "VOIDED",
        voidReason: `Reversal of ${original.id}: ${parsed.data.reason}`,
        voidApprovedById: approver.id,
        items: {
          create: original.items.map((item) => ({
            productId: item.productId,
            qty: -item.qty,
            unitPrice: item.unitPrice,
            discount: item.discount,
          })),
        },
      },
    });
  });

  return NextResponse.json({ success: true, reversal_transaction_id: reversal.id });
}
