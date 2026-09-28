import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { chartOfAccountSchema } from "@/lib/validations/accounting";

export async function GET() {
  const accounts = await prisma.chartOfAccount.findMany({ orderBy: { code: "asc" } });
  return NextResponse.json({ accounts });
}

export async function POST(request: Request) {
  const { user, response } = await requirePermission("admin:system_config");
  if (!user) return response!;

  const parsed = chartOfAccountSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.chartOfAccount.findUnique({ where: { code: parsed.data.code } });
  if (existing) {
    return NextResponse.json({ error: "Kode akun sudah dipakai" }, { status: 409 });
  }

  const account = await prisma.chartOfAccount.create({
    data: { ...parsed.data, updatedById: user.id },
  });
  return NextResponse.json({ account_id: account.id, success: true });
}
