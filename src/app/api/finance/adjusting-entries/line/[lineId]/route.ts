import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { updateAdjustingEntryLine } from "@/lib/accounting";
import { updateAdjustingEntryLineSchema } from "@/lib/validations/accounting";

// One line of a Jurnal Penyesuaian pair, edited inline in the grid.
// Changing `amount` auto-mirrors onto the paired line's opposite side
// (see updateAdjustingEntryLine) so the two lines can never go out of
// balance; account/remark/cost description/cost centre only ever touch
// this one line.
export async function PATCH(request: Request, { params }: { params: Promise<{ lineId: string }> }) {
  const { lineId } = await params;
  const { user, response } = await requirePermission("finance:manage_journal");
  if (!user) return response!;

  const parsed = updateAdjustingEntryLineSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await updateAdjustingEntryLine({ lineId, ...parsed.data });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal menyimpan baris jurnal" }, { status: 400 });
  }
}
