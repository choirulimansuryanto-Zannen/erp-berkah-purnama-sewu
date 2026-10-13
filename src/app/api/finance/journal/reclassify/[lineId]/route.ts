import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { TRANSITORY_ACCOUNT_CODE } from "@/lib/accounting-labels";

const bodySchema = z.object({ accountId: z.string().uuid() });

// Reassigns one JournalEntryLine away from its Buku Kas's Transitory
// (suspense) account to the real account it actually belongs to — the
// other half of the Jurnal Excel Import flow: every imported row lands
// against Transitory automatically (no account picker during upload,
// see journal-import.ts), and this is where it gets its real
// classification afterward. See the Reklasifikasi page
// (finance/journal/reklasifikasi), added per explicit request: "tetap
// memberikan ruang untuk menjurnal setiap transaksi tersebut setelah
// terupload ke sistem" (2026-10-13).
export async function PATCH(request: Request, { params }: { params: Promise<{ lineId: string }> }) {
  const { user, response } = await requirePermission("finance:manage_journal");
  if (!user) return response!;

  const { lineId } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const line = await prisma.journalEntryLine.findUnique({ where: { id: lineId }, include: { account: true } });
  if (!line) {
    return NextResponse.json({ error: "Baris jurnal tidak ditemukan." }, { status: 404 });
  }

  const transitoryCodes: string[] = Object.values(TRANSITORY_ACCOUNT_CODE);
  if (!transitoryCodes.includes(line.account.code)) {
    return NextResponse.json({ error: "Baris ini bukan baris Transitory — sudah diklasifikasi atau bukan hasil import." }, { status: 400 });
  }

  const newAccount = await prisma.chartOfAccount.findUnique({ where: { id: parsed.data.accountId } });
  if (!newAccount || newAccount.status !== "ACTIVE") {
    return NextResponse.json({ error: "Akun tujuan tidak valid." }, { status: 400 });
  }
  if (newAccount.cashBook) {
    return NextResponse.json({ error: "Tidak bisa memilih akun Buku Kas sebagai akun pengganti." }, { status: 400 });
  }

  await prisma.journalEntryLine.update({ where: { id: lineId }, data: { accountId: newAccount.id } });

  return NextResponse.json({ success: true, accountId: newAccount.id, accountLabel: `${newAccount.code} ${newAccount.name}` });
}
