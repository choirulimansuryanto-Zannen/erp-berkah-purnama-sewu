import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";

const CASH_BOOKS = ["KASIR", "BRANKAS", "OUTLET", "PETTY_CASH", "BANK_BCA", "BANK_MANDIRI"] as const;
const bodySchema = z.object({ officerName: z.string().min(1).max(200) });

// Sets the "Officer" (penanggung jawab) shown on a Buku Kas's printable
// header (finance/journal/buku-kas/[cashBook]) — one name per book,
// edited from Admin > Settings, reused everywhere that header appears.
export async function PUT(request: Request, { params }: { params: Promise<{ cashBook: string }> }) {
  const { user, response } = await requirePermission("admin:system_config");
  if (!user) return response!;

  const { cashBook } = await params;
  if (!(CASH_BOOKS as readonly string[]).includes(cashBook)) {
    return NextResponse.json({ error: "Buku Kas tidak valid." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const saved = await prisma.cashBookOfficer.upsert({
    where: { cashBook: cashBook as (typeof CASH_BOOKS)[number] },
    create: { cashBook: cashBook as (typeof CASH_BOOKS)[number], officerName: parsed.data.officerName, updatedById: user.id },
    update: { officerName: parsed.data.officerName, updatedById: user.id },
  });

  return NextResponse.json({ success: true, officerName: saved.officerName });
}
