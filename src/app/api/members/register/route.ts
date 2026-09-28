import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { registerMemberSchema } from "@/lib/validations/members";
import { generateMemberCode } from "@/lib/member-code";

export async function POST(request: Request) {
  const { user, response } = await requirePermission("member:register");
  if (!user) return response!;

  const parsed = registerMemberSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.member.findUnique({ where: { phone: parsed.data.phone } });
  if (existing) {
    return NextResponse.json({ error: "Phone number already registered" }, { status: 409 });
  }

  // Retry on the (very unlikely) chance of a code collision — not the phone
  // uniqueness, already checked above.
  let code = generateMemberCode();
  for (let attempt = 0; attempt < 5 && (await prisma.member.findUnique({ where: { code } })); attempt++) {
    code = generateMemberCode();
  }

  const member = await prisma.member.create({
    // outletId is deliberately not client-selectable — a cashier registers
    // a member under their own logged-in outlet, never an arbitrary one.
    data: { ...parsed.data, code, outletId: user.outletId, tier: "BRONZE", pointsBalance: 0 },
  });

  return NextResponse.json({
    member_id: member.id,
    code: member.code,
    name: member.name,
    tier: member.tier,
    points_balance: member.pointsBalance,
  });
}
