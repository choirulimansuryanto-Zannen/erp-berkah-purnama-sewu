import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { submitChecklistSchema } from "@/lib/validations/checklist";
import { getSessionDate } from "@/lib/session";

export async function GET(request: Request) {
  const { user, response } = await requirePermission("checklist:submit");
  if (!user || !user.outletId) return response!;

  const pramuniagaRosterId = new URL(request.url).searchParams.get("pramuniagaRosterId");
  const sessionDate = await getSessionDate(user.id);

  const [items, submissions] = await Promise.all([
    prisma.operationalChecklistItem.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.operationalChecklistSubmission.findMany({
      where: { outletId: user.outletId, date: sessionDate, pramuniagaRosterId },
      select: { itemId: true, photoUrl: true, submittedAt: true },
    }),
  ]);

  return NextResponse.json({ items, submissions, sessionDate });
}

export async function POST(request: Request) {
  const { user, response } = await requirePermission("checklist:submit");
  if (!user || !user.outletId) return response!;

  const parsed = submitChecklistSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const itemIds = parsed.data.items.map((i) => i.itemId);
  const validItems = await prisma.operationalChecklistItem.findMany({ where: { id: { in: itemIds } } });
  if (validItems.length !== new Set(itemIds).size) {
    return NextResponse.json({ error: "One or more checklist items not found" }, { status: 400 });
  }

  const sessionDate = await getSessionDate(user.id);
  const outletId = user.outletId;
  const pramuniagaRosterId = parsed.data.pramuniagaRosterId;

  await prisma.$transaction(
    parsed.data.items.map((item) =>
      prisma.operationalChecklistSubmission.upsert({
        where: {
          itemId_outletId_date_pramuniagaRosterId: { itemId: item.itemId, outletId, date: sessionDate, pramuniagaRosterId },
        },
        create: { itemId: item.itemId, outletId, userId: user.id, pramuniagaRosterId, date: sessionDate, photoUrl: item.photoUrl },
        update: { photoUrl: item.photoUrl, userId: user.id, submittedAt: new Date() },
      }),
    ),
  );

  return NextResponse.json({ success: true, saved: parsed.data.items.length });
}
