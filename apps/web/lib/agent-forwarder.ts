import { AgentEndpointError } from '@nexus-protocol/shared';
import type { A2AMessage } from '@nexus-protocol/shared';

interface A2ATaskResponse {
  id: string;
  status: string;
  messages: Array<{ role: string; parts: Array<{ type: string; data: unknown }> }>;
  artifacts: Array<{ parts: Array<{ type: string; data: unknown }>; name?: string; description?: string }>;
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function forwardToAgent(
  endpoint: string,
  taskId: string,
  message: A2AMessage,
): Promise<A2ATaskResponse> {
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: taskId,
    method: 'message/send',
    params: { id: taskId, message },
  });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(BASE_DELAY_MS * Math.pow(2, attempt - 1));
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status}: ${res.statusText}`);
        continue;
      }

      const json = (await res.json()) as {
        result?: A2ATaskResponse;
        error?: { code: number; message: string };
      };

      if (json.error) {
        lastError = new Error(`JSON-RPC error ${json.error.code}: ${json.error.message}`);
        continue;
      }

      if (!json.result) {
        lastError = new Error('Empty result from agent');
        continue;
      }

      return json.result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw new AgentEndpointError(endpoint, lastError?.message);
}
