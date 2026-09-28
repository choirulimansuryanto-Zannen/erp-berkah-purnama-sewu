import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { dailyStockCheckSchema } from "@/lib/validations/inventory";
import { isWithinTolerance } from "@/lib/inventory";
import { getSessionDate } from "@/lib/session";
import { getBusinessSettings } from "@/lib/business-settings";

export async function POST(request: Request) {
  const { user, response } = await requirePermission("inventory:record_check");
  if (!user || !user.outletId) return response!;

  const parsed = dailyStockCheckSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  const settings = await getBusinessSettings();
  const systemBalance = input.openingBalance + input.received - input.used - input.rejected;
  const variance = input.closingBalance - systemBalance;
  const reconciled = isWithinTolerance(variance, systemBalance, settings);

  if (!reconciled && !input.varianceReason) {
    return NextResponse.json(
      { error: "varianceReason required when closing balance differs from system balance beyond tolerance" },
      { status: 400 },
    );
  }

  // Stock checks are logged against the shift session's date, not the
  // calendar day of submission — a closing count taken after midnight still
  // belongs to the session that started the day before.
  const sessionDate = await getSessionDate(user.id);

  const record = await prisma.inventoryRecord.upsert({
    where: { outletId_productId_date: { outletId: user.outletId, productId: input.productId, date: sessionDate } },
    create: {
      outletId: user.outletId,
      productId: input.productId,
      date: sessionDate,
      openingBalance: input.openingBalance,
      received: input.received,
      used: input.used,
      rejected: input.rejected,
      closingBalance: input.closingBalance,
      systemBalance,
      variance,
      varianceReason: input.varianceReason,
      photoUrl: input.photoUrl,
      reconciled,
    },
    update: {
      openingBalance: input.openingBalance,
      received: input.received,
      used: input.used,
      rejected: input.rejected,
      closingBalance: input.closingBalance,
      systemBalance,
      variance,
      varianceReason: input.varianceReason,
      photoUrl: input.photoUrl,
      reconciled,
    },
  });

  return NextResponse.json({
    success: true,
    variance_flagged: !reconciled,
    escalation_needed: !reconciled && Math.abs(variance) > settings.inventoryEscalationUnits,
    record_id: record.id,
  });
}
