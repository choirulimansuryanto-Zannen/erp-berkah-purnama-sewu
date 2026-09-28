import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth"];

/** Set only here, after a real `supabase.auth.getUser()` round-trip — every
 * matched request passes through this middleware first (see proxy.ts's
 * config.matcher), so a client can never reach a page or route handler
 * without this header having just been overwritten to the true value. Lets
 * `getCurrentUser()` skip its own second `getUser()` call on the happy path,
 * cutting the per-request Supabase auth tax in half. */
export const TRUSTED_USER_ID_HEADER = "x-berkah-verified-user-id";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Overwrite unconditionally (never merge/append a client-supplied value)
  // so this header is always exactly what we just verified, whether that's
  // a real user id or nothing.
  const forwardedHeaders = new Headers(request.headers);
  if (user) forwardedHeaders.set(TRUSTED_USER_ID_HEADER, user.id);
  else forwardedHeaders.delete(TRUSTED_USER_ID_HEADER);

  const response = NextResponse.next({ request: { headers: forwardedHeaders } });
  supabaseResponse.cookies.getAll().forEach((c) => response.cookies.set(c.name, c.value, c));
  return response;
}
