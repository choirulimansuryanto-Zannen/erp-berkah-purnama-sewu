import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { TRUSTED_USER_ID_HEADER } from "@/lib/supabase/middleware";
import { prisma } from "@/lib/prisma";

// The middleware (proxy.ts) already ran `supabase.auth.getUser()` for this
// exact request and stamped the result into a header only it can set —
// every matched path passes through it first, so this header can be trusted
// without repeating that same network round-trip to Supabase here. Falls
// back to calling Supabase directly if the header is somehow absent (e.g.
// a request path middleware's matcher doesn't cover).
export const getCurrentUser = cache(async () => {
  const headerList = await headers();
  const trustedUserId = headerList.get(TRUSTED_USER_ID_HEADER);

  let authUserId: string | null = trustedUserId;
  if (!authUserId) {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    authUserId = authUser?.id ?? null;
  }

  if (!authUserId) return null;

  const user = await prisma.user.findUnique({
    where: { id: authUserId },
    include: { outlet: { include: { region: true } } },
  });

  return user;
});
