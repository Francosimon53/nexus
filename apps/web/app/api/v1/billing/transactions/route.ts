import { NextRequest } from 'next/server';
import { authenticateApiKey } from '@/lib/api-key-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { successResponse, errorResponse } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiKey(request);
    const supabase = getSupabaseAdmin();
    const url = new URL(request.url);

    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 100);
    const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);
    const type = url.searchParams.get('type');

    let query = supabase
      .from('credit_transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', auth.userId);

    if (type) query = query.eq('type', type);

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) return errorResponse(new Error(error.message));

    return successResponse({ transactions: data ?? [], total: count ?? 0, limit, offset });
  } catch (err) {
    return errorResponse(err);
  }
}
