import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { journalVoucherSchema } from "@/lib/validations/accounting";
import { postCashVoucher } from "@/lib/accounting";

export async function GET(request: Request) {
  const { user, response } = await requirePermission("finance:view_ledger");
  if (!user) return response!;

  const { searchParams } = new URL(request.url);
  const cashBook = searchParams.get("cashBook");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const entries = await prisma.journalEntry.findMany({
    where: {
      ...(cashBook ? { cashBook: cashBook as never } : {}),
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}),
              ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
            },
          }
        : {}),
    },
    include: { lines: { include: { account: true } }, outlet: true, createdBy: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 200,
  });
  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  const { user, response } = await requirePermission("finance:manage_journal");
  if (!user) return response!;

  const parsed = journalVoucherSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  if (data.entryType === "TRANSFER_ANTAR_BUKU") {
    const destAccount = await prisma.chartOfAccount.findUnique({ where: { id: data.contraAccountId } });
    if (!destAccount?.cashBook) {
      return NextResponse.json({ error: "Transfer antar buku harus memilih akun buku kas tujuan." }, { status: 400 });
    }
    if (destAccount.cashBook === data.cashBook) {
      return NextResponse.json({ error: "Buku kas asal dan tujuan tidak boleh sama." }, { status: 400 });
    }
  }

  try {
    const entry = await postCashVoucher({
      cashBook: data.cashBook,
      entryType: data.entryType,
      date: data.date,
      outletId: data.outletId ?? null,
      description: data.description,
      reference: data.reference,
      contraAccountId: data.contraAccountId,
      amount: data.amount,
      createdById: user.id,
    });
    return NextResponse.json({ entry_id: entry.id, entry_number: entry.entryNumber, success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal membuat jurnal" }, { status: 400 });
  }
}
