import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { journalImportPostSchema } from "@/lib/validations/journal-import";
import { postJournalImportBatch } from "@/lib/journal-import";

// Posts a batch of already-parsed, already-classified rows (see
// JournalImportForm — the Excel file itself is parsed client-side with
// exceljs, same as ExportExcelButton's export path) as real journal
// entries. Every row must already carry a resolved contraAccountId; the
// client's preview step is what makes sure none are left unmapped before
// this is ever called.
export async function POST(request: Request) {
  const { user, response } = await requirePermission("finance:manage_journal");
  if (!user) return response!;

  const parsed = journalImportPostSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await postJournalImportBatch({ cashBook: parsed.data.cashBook, rows: parsed.data.rows, createdById: user.id });
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal mengimpor jurnal" }, { status: 400 });
  }
}
