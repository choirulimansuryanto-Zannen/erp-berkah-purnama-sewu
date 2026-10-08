import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { createReceivableEntrySchema } from "@/lib/validations/vendor";

export async function POST(request: Request) {
  const { user, response } = await requirePermission("finance:manage_journal");
  if (!user) return response!;

  const parsed = createReceivableEntrySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { date, mitraCode, mitraName, noFaktur, tglFaktur, description, debt, credit, remarks, group } = parsed.data;

  const entry = await prisma.receivableEntry.create({
    data: {
      date: new Date(`${date}T00:00:00.000Z`),
      mitraCode,
      mitraName,
      noFaktur,
      tglFaktur: tglFaktur ? new Date(`${tglFaktur}T00:00:00.000Z`) : null,
      description,
      debt,
      credit,
      remarks,
      group,
      recordedById: user.id,
    },
  });
  return NextResponse.json({ success: true, id: entry.id });
}
