import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { createUserSchema } from "@/lib/validations/admin";

export async function GET() {
  const { user, response } = await requirePermission("admin:manage_users");
  if (!user) return response!;

  const users = await prisma.user.findMany({
    include: { outlet: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const { user, response } = await requirePermission("admin:manage_users");
  if (!user) return response!;

  const parsed = createUserSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  const admin = createAdminClient();
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.tempPassword,
    email_confirm: true,
  });

  if (authError || !authUser.user) {
    return NextResponse.json({ error: authError?.message ?? "Failed to create auth user" }, { status: 400 });
  }

  try {
    const created = await prisma.user.create({
      data: {
        id: authUser.user.id,
        email: input.email,
        name: input.name,
        phone: input.phone,
        role: input.role,
        outletId: input.outletId,
        ...(input.shift ? { shift: input.shift } : {}),
      },
    });
    return NextResponse.json({ user_id: created.id, success: true, welcome_email_sent: false });
  } catch (err) {
    // Roll back the auth user if the Prisma record couldn't be created.
    await admin.auth.admin.deleteUser(authUser.user.id);
    throw err;
  }
}
