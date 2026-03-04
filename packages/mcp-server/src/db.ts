import { createSupabaseAdmin } from '@nexus-protocol/database';

let _client: ReturnType<typeof createSupabaseAdmin> | null = null;

export function getDb() {
  if (!_client) {
    _client = createSupabaseAdmin();
  }
  return _client;
}
