import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { ensureCreditBalance } from '@/lib/billing';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/agents';
  const baseUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? new URL(request.url).origin;

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/auth/login?error=missing_code`);
  }

  const response = NextResponse.redirect(`${baseUrl}${next}`);

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
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${baseUrl}/auth/login?error=auth_failed`);
  }

  // Auto-create credit balance for new users (1000 free credits)
  try {
    const admin = getSupabaseAdmin();
    await ensureCreditBalance(admin, data.user.id);
  } catch (e) {
    console.error('Failed to create credit balance for new user:', e);
  }

  return response;
}
