import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { journalImportPostSchema } from "@/lib/validations/journal-import";
import { postJournalImportBatch } from "@/lib/journal-import";

// Posts a batch of already-parsed rows (see JournalImportForm — the
// Excel file itself is parsed client-side with exceljs, same as
// ExportExcelButton's export path) as real journal entries. The akun
// lawan is resolved server-side from each Buku Kas's own Transitory
// account — the client never picks or sends one.
export async function POST(request: Request) {
  const { user, response } = await requirePermission("finance:manage_journal");
  if (!user) return response!;

  const parsed = journalImportPostSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await postJournalImportBatch({
      cashBook: parsed.data.cashBook,
      rows: parsed.data.rows,
      createdById: user.id,
      fileName: parsed.data.fileName,
      targetYear: parsed.data.targetYear,
      targetMonth: parsed.data.targetMonth,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal mengimpor jurnal" }, { status: 400 });
  }
}
