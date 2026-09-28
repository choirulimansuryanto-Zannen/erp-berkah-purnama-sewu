import { NextResponse } from "next/server";
import { requirePermission, requireUser } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { createPramuniagaRosterSchema } from "@/lib/validations/pramuniaga-roster";

// Any authenticated user can read the roster — pramuniaga need it to
// populate the "Nama" selector at check-in.
export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response!;

  const roster = await prisma.pramuniagaRoster.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } });
  return NextResponse.json({ roster });
}

export async function POST(request: Request) {
  const { user, response } = await requirePermission("admin:system_config");
  if (!user) return response!;

  const parsed = createPramuniagaRosterSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const entry = await prisma.pramuniagaRoster.create({ data: parsed.data });
  return NextResponse.json({ roster_id: entry.id, success: true });
}
