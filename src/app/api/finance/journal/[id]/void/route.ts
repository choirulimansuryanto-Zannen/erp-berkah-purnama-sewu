import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { voidJournalEntrySchema } from "@/lib/validations/accounting";

// A journal entry is never edited or hard-deleted once posted — that would
// silently rewrite history the business already reconciled against. Voiding
// keeps the row (and its number) but zeroes it out of every balance/report
// going forward, with who and why on record.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, response } = await requirePermission("finance:manage_journal");
  if (!user) return response!;

  const parsed = voidJournalEntrySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const entry = await prisma.journalEntry.findUnique({ where: { id } });
  if (!entry) return NextResponse.json({ error: "Jurnal tidak ditemukan" }, { status: 404 });
  if (entry.status === "VOID") {
    return NextResponse.json({ error: "Jurnal ini sudah dibatalkan sebelumnya" }, { status: 409 });
  }

  await prisma.journalEntry.update({
    where: { id },
    data: { status: "VOID", voidedById: user.id, voidedAt: new Date(), voidReason: parsed.data.reason },
  });
  return NextResponse.json({ success: true });
}
