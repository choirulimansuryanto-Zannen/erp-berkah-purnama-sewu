import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { user, response } = await requirePermission("member:view");
  if (!user) return response!;

  const { searchParams } = new URL(request.url);
  const phone = searchParams.get("phone");
  const id = searchParams.get("id");

  if (!phone && !id) {
    return NextResponse.json({ error: "phone or id query param required" }, { status: 400 });
  }

  const member = await prisma.member.findUnique({
    where: id ? { id } : { phone: phone! },
  });

  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  return NextResponse.json({
    member_id: member.id,
    code: member.code,
    name: member.name,
    tier: member.tier,
    points: member.pointsBalance,
  });
}
