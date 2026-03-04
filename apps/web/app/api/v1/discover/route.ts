import { NextRequest } from 'next/server';
import { DiscoverAgentsQuerySchema } from '@nexus-protocol/shared';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { successResponse, errorResponse } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
    const query = DiscoverAgentsQuerySchema.parse(raw);

    const supabase = getSupabaseAdmin();
    let builder = supabase.from('agents').select('*', { count: 'exact' });

    if (query.skillTags && query.skillTags.length > 0) {
      builder = builder.overlaps('tags', query.skillTags);
    }

    if (query.category) {
      builder = builder.contains('tags', [query.category]);
    }

    if (query.minTrustScore !== undefined) {
      builder = builder.gte('trust_score', query.minTrustScore);
    }

    if (query.status) {
      builder = builder.eq('status', query.status);
    }

    builder = builder.order('trust_score', { ascending: false });
    builder = builder.range(query.offset, query.offset + query.limit - 1);

    const { data, error, count } = await builder;

    if (error) {
      console.error('Discover agents error:', error);
      return errorResponse(new Error(error.message));
    }

    return successResponse({
      agents: data ?? [],
      total: count ?? 0,
      limit: query.limit,
      offset: query.offset,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
