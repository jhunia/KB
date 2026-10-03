import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function proxy(req: NextRequest) {
  let supabaseResponse = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: use getUser() not getSession() — getUser() re-validates the JWT with Supabase servers
  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = req.nextUrl;

  // ── /profile requires authentication ──────────────────────────────────────
  if (pathname.startsWith('/profile') && !user) {
    return NextResponse.redirect(new URL('/auth', req.url));
  }

  // ── /admin requires authentication AND admin role ─────────────────────────
  if (pathname.startsWith('/admin')) {
    if (!user) {
      // Come back to the same admin page after signing in (e.g. the order an alert opened)
      const login = new URL('/auth', req.url);
      login.searchParams.set('redirect', pathname + req.nextUrl.search);
      return NextResponse.redirect(login);
    }

    // Verify role server-side from the profiles table.
    // This prevents a logged-in customer from accessing /admin.
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/profile/:path*', '/admin/:path*'],
};
