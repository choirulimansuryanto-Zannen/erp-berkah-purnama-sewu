import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { createVendorLedgerEntrySchema } from "@/lib/validations/vendor";

export async function POST(request: Request) {
  const { user, response } = await requirePermission("finance:manage_journal");
  if (!user) return response!;

  const parsed = createVendorLedgerEntrySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { vendorId, date, hutang, bayar, remarks } = parsed.data;

  const entry = await prisma.vendorLedgerEntry.create({
    data: { vendorId, date: new Date(`${date}T00:00:00.000Z`), hutang, bayar, remarks, recordedById: user.id },
  });
  return NextResponse.json({ success: true, id: entry.id });
}
