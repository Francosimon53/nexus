import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Get the authenticated user ID from the request cookies.
 * For use in API routes that serve the dashboard (not external API key auth).
 * Returns null if not authenticated.
 */
export async function getApiUserId(): Promise<string | null> {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // API routes don't need to set cookies
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Require authenticated user in API routes. Returns 401 if not authenticated.
 * Returns user ID on success.
 */
export async function requireApiUser(): Promise<string> {
  const userId = await getApiUserId();
  if (!userId) {
    throw new Error('Unauthorized');
  }
  return userId;
}
