import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { outletLedgerEntrySchema } from "@/lib/validations/outlet-ledger";

export async function GET(request: Request) {
  const { user, response } = await requirePermission("finance:view_ledger");
  if (!user) return response!;

  const { searchParams } = new URL(request.url);
  const outletId = searchParams.get("outletId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const rows = await prisma.outletLedgerEntry.findMany({
    where: {
      ...(outletId ? { outletId } : {}),
      ...(from || to
        ? { date: { ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}) } }
        : {}),
    },
    include: { account: true, createdBy: { select: { name: true } } },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    take: 1000,
  });
  return NextResponse.json({ rows });
}

export async function POST(request: Request) {
  const { user, response } = await requirePermission("finance:manage_journal");
  if (!user) return response!;

  const parsed = outletLedgerEntrySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { outletId, date, accountId, description, side, amount, note } = parsed.data;

  const account = await prisma.outletLedgerAccount.findUnique({ where: { id: accountId } });
  if (!account) return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 404 });

  const row = await prisma.outletLedgerEntry.create({
    data: { outletId, date, accountId, description, side, amount, note, createdById: user.id },
  });
  return NextResponse.json({ success: true, id: row.id });
}
