import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { outletLedgerAccountSchema } from "@/lib/validations/outlet-ledger";

export async function GET() {
  const accounts = await prisma.outletLedgerAccount.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ accounts });
}

export async function POST(request: Request) {
  const { user, response } = await requirePermission("admin:system_config");
  if (!user) return response!;

  const parsed = outletLedgerAccountSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.outletLedgerAccount.findUnique({ where: { number: parsed.data.number } });
  if (existing) {
    return NextResponse.json({ error: "No. Akun sudah dipakai" }, { status: 409 });
  }

  const account = await prisma.outletLedgerAccount.create({ data: { ...parsed.data, updatedById: user.id } });
  return NextResponse.json({ success: true, id: account.id });
}
