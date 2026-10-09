import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { createBlankAdjustingEntry } from "@/lib/accounting";
import { createBlankAdjustingEntrySchema } from "@/lib/validations/accounting";

// Bootstraps a new balanced (0/0) transaction pair for the Jurnal
// Penyesuaian grid — the two accounts are chosen here (a line can't
// exist without one); everything else (amounts, remark, cost
// description, cost centre) is then filled in via inline edits
// (PATCH /api/finance/adjusting-entries/line/[lineId]).
export async function POST(request: Request) {
  const { user, response } = await requirePermission("finance:manage_journal");
  if (!user) return response!;

  const parsed = createBlankAdjustingEntrySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const entry = await createBlankAdjustingEntry({ ...parsed.data, createdById: user.id });
    return NextResponse.json({ success: true, journalEntryId: entry.id, lines: entry.lines });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal membuat transaksi" }, { status: 400 });
  }
}
