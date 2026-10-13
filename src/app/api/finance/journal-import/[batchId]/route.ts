import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { deleteJournalImportBatch } from "@/lib/journal-import";

// Undo an entire import batch — every entry + line it created, then the
// batch row itself. For when the wrong Buku Kas / Tahun / Bulan was
// picked before posting.
export async function DELETE(request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const { user, response } = await requirePermission("finance:manage_journal");
  if (!user) return response!;

  const { batchId } = await params;
  try {
    const count = await deleteJournalImportBatch(batchId);
    return NextResponse.json({ success: true, deleted: count });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal membatalkan import" }, { status: 400 });
  }
}
