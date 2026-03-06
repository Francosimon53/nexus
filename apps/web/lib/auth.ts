import { redirect } from 'next/navigation';
import { createSupabaseSSR } from './supabase';
import type { User } from '@supabase/supabase-js';

/**
 * Get the current authenticated user, or null if not logged in.
 */
export async function getUser(): Promise<User | null> {
  const supabase = await createSupabaseSSR();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Require an authenticated user. Redirects to /auth/login if not logged in.
 * Use in server components and server actions.
 */
export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) redirect('/auth/login');
  return user;
}

/**
 * Get the user ID from the current session, or null.
 * Lighter weight than getUser() — uses getSession() which reads from cookie without network call.
 */
export async function getUserId(): Promise<string | null> {
  const supabase = await createSupabaseSSR();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}
