import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { adjustingEntrySchema } from "@/lib/validations/accounting";
import { postAdjustingEntry } from "@/lib/accounting";

export async function GET(request: Request) {
  const { user, response } = await requirePermission("finance:view_ledger");
  if (!user) return response!;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const entries = await prisma.journalEntry.findMany({
    where: {
      entryType: "JURNAL_PENYESUAIAN",
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}),
              ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
            },
          }
        : {}),
    },
    include: { lines: { include: { account: true } }, createdBy: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 200,
  });
  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  const { user, response } = await requirePermission("finance:manage_journal");
  if (!user) return response!;

  const parsed = adjustingEntrySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  try {
    const entry = await postAdjustingEntry({
      date: data.date,
      description: data.description,
      reference: data.reference,
      debitAccountId: data.debitAccountId,
      creditAccountId: data.creditAccountId,
      amount: data.amount,
      createdById: user.id,
    });
    return NextResponse.json({ entry_id: entry.id, entry_number: entry.entryNumber, success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal membuat jurnal penyesuaian" }, { status: 400 });
  }
}
