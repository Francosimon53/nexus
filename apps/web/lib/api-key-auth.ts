import type { NextRequest } from 'next/server';
import { getSupabaseAdmin } from './supabase-admin';
import { verifyApiKey } from './api-key-utils';
import { UnauthorizedError } from '@nexus-protocol/shared';

interface AuthResult {
  userId: string;
  keyId: string;
  scopes: string[];
}

export async function authenticateApiKey(request: NextRequest): Promise<AuthResult> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid Authorization header');
  }

  const rawKey = authHeader.slice(7);
  if (!rawKey.startsWith('nxk_')) {
    throw new UnauthorizedError('Invalid API key format');
  }

  const prefix = rawKey.slice(0, 8);
  const supabase = getSupabaseAdmin();

  // Find candidate keys by prefix
  const { data: candidates } = await supabase
    .from('api_keys')
    .select('id, user_id, key_hash, scopes, expires_at')
    .eq('prefix', prefix);

  if (!candidates || candidates.length === 0) {
    throw new UnauthorizedError('Invalid API key');
  }

  for (const candidate of candidates) {
    // Check expiration
    if (candidate.expires_at && new Date(candidate.expires_at as string) < new Date()) {
      continue;
    }

    if (verifyApiKey(rawKey, candidate.key_hash as string)) {
      // Update last_used_at
      await supabase
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', candidate.id);

      return {
        userId: candidate.user_id as string,
        keyId: candidate.id as string,
        scopes: candidate.scopes as string[],
      };
    }
  }

  throw new UnauthorizedError('Invalid API key');
}
