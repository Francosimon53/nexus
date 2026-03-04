import { NextRequest } from 'next/server';
import { authenticateApiKey } from '@/lib/api-key-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { getBalance } from '@/lib/billing';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiKey(request);
    const supabase = getSupabaseAdmin();
    const balance = await getBalance(supabase, auth.userId);
    return successResponse(balance);
  } catch (err) {
    return errorResponse(err);
  }
}
