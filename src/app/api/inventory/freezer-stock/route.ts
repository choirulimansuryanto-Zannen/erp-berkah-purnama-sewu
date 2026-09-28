import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { freezerStockRecordSchema } from "@/lib/validations/inventory";
import { getSessionDate, getSessionTimeRange, startOfToday } from "@/lib/session";
import { computeFreezerUsedByName } from "@/lib/freezer-stock";

// Saldo Awal/Masuk/Reject are the cashier's own entry; "Pakai" is always
// recomputed here from the live mirror (see computeFreezerUsedByName) rather
// than trusted from the client — same server-of-record principle as
// Terjual Sistem on the Laporan Harian stock table.
export async function POST(request: Request) {
  const { user, response } = await requirePermission("inventory:record_check");
  if (!user || !user.outletId) return response!;

  const parsed = freezerStockRecordSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { freezerMaterialId, openingBalance, received, rejected } = parsed.data;

  const material = await prisma.freezerMaterial.findUnique({ where: { id: freezerMaterialId } });
  if (!material) {
    return NextResponse.json({ error: "Freezer material not found" }, { status: 404 });
  }

  const sessionDate = await getSessionDate(user.id);
  const timeRange = (await getSessionTimeRange(user.id)) ?? { from: startOfToday(), to: new Date() };

  const usedByName = await computeFreezerUsedByName(user.outletId, user.id, sessionDate, timeRange);
  const used = usedByName[material.name] ?? 0;
  const closingBalance = openingBalance + received - used - rejected;

  const record = await prisma.freezerStockRecord.upsert({
    where: { outletId_freezerMaterialId_date: { outletId: user.outletId, freezerMaterialId, date: sessionDate } },
    create: { outletId: user.outletId, freezerMaterialId, date: sessionDate, openingBalance, received, used, rejected, closingBalance },
    update: { openingBalance, received, used, rejected, closingBalance },
  });

  return NextResponse.json({ success: true, used, closingBalance, record_id: record.id });
}
