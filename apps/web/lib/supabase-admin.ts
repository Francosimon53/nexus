import { createClient, SupabaseClient } from '@supabase/supabase-js';

let admin: SupabaseClient | null = null;

// TODO(phase-2): Replace admin client with authenticated SSR client
export function getSupabaseAdmin(): SupabaseClient {
  if (admin) return admin;

  const url = process.env['SUPABASE_URL'] ?? process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return admin;
}
