import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set(name, value);
            response = NextResponse.next({ request });
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Refresh the session (important for token rotation)
  const { data: { user } } = await supabase.auth.getUser();

  // Protect dashboard routes — redirect to login if not authenticated
  const { pathname } = request.nextUrl;
  const isDashboardRoute =
    pathname.startsWith('/agents') ||
    pathname.startsWith('/tasks') ||
    pathname.startsWith('/workflows') ||
    pathname.startsWith('/billing') ||
    pathname.startsWith('/settings');

  if (isDashboardRoute && !user) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If logged in and visiting auth pages, redirect to dashboard
  if (user && pathname.startsWith('/auth/')) {
    return NextResponse.redirect(new URL('/agents', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // Match all routes except static files, api routes, and _next
    '/((?!_next/static|_next/image|favicon.ico|api/|marketplace|_next|\\.).*)',
  ],
};
