import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  cashBook: z.enum(["KASIR", "BRANKAS", "OUTLET", "PETTY_CASH", "BANK_BCA", "BANK_MANDIRI"]),
  defaultDbAccountId: z.string().uuid().nullable(),
  defaultCrAccountId: z.string().uuid().nullable(),
});

// Saves a Buku Kas's remembered akun lawan outside the upload flow — see
// JournalImportForm's "Atur Akun Lawan Default" panel. Kept as its own
// action (not bundled into a journal-import POST) so configuring the
// account never has to happen "di tengah proses mengupload" (2026-10-13).
export async function PUT(request: Request) {
  const { user, response } = await requirePermission("finance:manage_journal");
  if (!user) return response!;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { cashBook, defaultDbAccountId, defaultCrAccountId } = parsed.data;

  const saved = await prisma.journalImportDefaultAccount.upsert({
    where: { cashBook },
    create: { cashBook, defaultDbAccountId, defaultCrAccountId },
    update: { defaultDbAccountId, defaultCrAccountId },
  });

  return NextResponse.json({ success: true, cashBook: saved.cashBook, defaultDbAccountId: saved.defaultDbAccountId, defaultCrAccountId: saved.defaultCrAccountId });
}
