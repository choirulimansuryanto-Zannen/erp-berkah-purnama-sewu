import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { createOutletInvestorShareSchema } from "@/lib/validations/outlet-investor";

export async function GET() {
  const { user, response } = await requirePermission("finance:view_ledger");
  if (!user) return response!;

  const investors = await prisma.outletInvestorProfile.findMany({
    where: { status: "ACTIVE" },
    include: { shares: { where: { status: "ACTIVE" }, include: { outlet: { select: { id: true, name: true } } } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ investors });
}

// Creates a new investor (with its first outlet share) when investorId is
// omitted, or adds another outlet share to an existing investor when
// investorId is given — see createOutletInvestorShareSchema.
export async function POST(request: Request) {
  const { user, response } = await requirePermission("finance:manage_journal");
  if (!user) return response!;

  const parsed = createOutletInvestorShareSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { investorId, investorName, outletId, slotNumber, shareType, shareValue, openingBalance } = parsed.data;

  const existingSlot = await prisma.outletInvestorShare.findUnique({ where: { outletId_slotNumber: { outletId, slotNumber } }, select: { id: true, status: true } });
  if (existingSlot && existingSlot.status === "ACTIVE") {
    return NextResponse.json({ error: `Slot ${slotNumber} di outlet ini sudah dipakai investor lain.` }, { status: 409 });
  }

  let resolvedInvestorId = investorId;
  if (!resolvedInvestorId) {
    if (!investorName) {
      return NextResponse.json({ error: "investorName wajib diisi untuk investor baru." }, { status: 400 });
    }
    // Reuse an existing investor with the exact same name rather than
    // silently creating a duplicate profile — the common case is adding a
    // second (or third) outlet's MoU for someone already tracked.
    const existing = await prisma.outletInvestorProfile.findFirst({ where: { name: investorName, status: "ACTIVE" } });
    resolvedInvestorId = existing
      ? existing.id
      : (await prisma.outletInvestorProfile.create({ data: { name: investorName, openingBalance: openingBalance ?? 0, createdById: user.id } })).id;
  }

  const share = await prisma.outletInvestorShare.create({
    data: { investorId: resolvedInvestorId, outletId, slotNumber, shareType, shareValue, createdById: user.id },
  });
  return NextResponse.json({ success: true, investorId: resolvedInvestorId, shareId: share.id });
}
