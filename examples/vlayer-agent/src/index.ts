import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createLogger } from '@nexus-protocol/shared';

const PORT = parseInt(process.env['PORT'] ?? '4003', 10);
const VLAYER_API_KEY = process.env['VLAYER_API_KEY'];
const VLAYER_BASE_URL = process.env['VLAYER_BASE_URL'] ?? 'https://api.vlayer.app';

if (!VLAYER_API_KEY) {
  console.error('Missing VLAYER_API_KEY environment variable');
  process.exit(1);
}

const logger = createLogger('vlayer-agent');

const AGENT_CARD = {
  name: 'VLayer HIPAA Scanner',
  description:
    'Scans code and GitHub repos for HIPAA compliance violations. Detects PHI exposure, missing encryption, insecure endpoints, and 163+ rules.',
  url: process.env['AGENT_URL'] ?? `http://localhost:${PORT}`,
  version: '1.0.0',
  capabilities: {
    streaming: false,
    pushNotifications: false,
    stateTransitionHistory: false,
  },
  skills: [
    {
      id: 'hipaa-scan',
      name: 'HIPAA Scan',
      description: 'Full HIPAA compliance scan of a codebase',
      tags: ['hipaa', 'compliance', 'healthcare', 'security'],
      examples: ['Scan this repo for HIPAA violations', 'Check my code for PHI exposure'],
    },
    {
      id: 'phi-detection',
      name: 'PHI Detection',
      description: 'Detect exposed Protected Health Information',
      tags: ['hipaa', 'phi', 'healthcare'],
      examples: ['Find PHI in this code', 'Check for exposed patient data'],
    },
    {
      id: 'compliance-audit',
      name: 'Compliance Audit',
      description: 'Generate HIPAA compliance audit report',
      tags: ['hipaa', 'compliance', 'audit'],
      examples: ['Generate a HIPAA audit report for this codebase'],
    },
  ],
  authentication: { schemes: ['bearer'] },
};

// --- Types ---

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface TaskState {
  id: string;
  status: string;
  messages: Array<{ role: string; parts: Array<{ type: string; data: unknown }> }>;
  artifacts: Array<{ parts: Array<{ type: string; data: unknown }> }>;
}

interface VLayerFinding {
  rule: string;
  severity: string;
  message: string;
  file?: string;
  line?: number;
}

interface VLayerScanResult {
  score?: number;
  grade?: string;
  findings?: VLayerFinding[];
  summary?: { critical?: number; high?: number; medium?: number; low?: number; info?: number };
  recommendations?: string[];
}

interface VLayerRepoResponse {
  jobId?: string;
  status?: string;
  pollUrl?: string;
  error?: string;
}

interface VLayerPollResponse {
  status: string;
  result?: VLayerScanResult;
  error?: string;
}

// --- State ---

const tasks = new Map<string, TaskState>();

// --- Helpers ---

function jsonResponse(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const GITHUB_REPO_RE = /^https?:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/;

function extractInput(params: Record<string, unknown>): { repoUrl?: string; code?: string } {
  const message = params['message'] as
    | { role: string; parts: Array<{ type: string; data: unknown }> }
    | undefined;

  if (!message?.parts) return {};

  const texts = message.parts
    .filter((p) => p.type === 'text')
    .map((p) => {
      const data = p.data;
      if (typeof data === 'string') {
        try {
          const parsed = JSON.parse(data) as unknown;
          if (typeof parsed === 'object' && parsed !== null) {
            const obj = parsed as Record<string, unknown>;
            if (typeof obj['repoUrl'] === 'string') return obj['repoUrl'];
            if (typeof obj['repo'] === 'string') return obj['repo'];
            if (typeof obj['url'] === 'string') return obj['url'];
            if (typeof obj['code'] === 'string') return obj['code'];
            if (typeof obj['text'] === 'string') return String(obj['text']);
            return JSON.stringify(parsed);
          }
          if (typeof parsed === 'string') return parsed;
          return JSON.stringify(parsed);
        } catch {
          return data;
        }
      }
      return String(data);
    });

  const combined = texts.join('\n').trim();
  if (!combined) return {};

  // Check if input looks like a GitHub repo URL
  const urlMatch = combined.match(GITHUB_REPO_RE);
  if (urlMatch) {
    return { repoUrl: urlMatch[0] };
  }

  // Check if any line is a GitHub URL
  for (const line of combined.split('\n')) {
    const trimmed = line.trim();
    if (GITHUB_REPO_RE.test(trimmed)) {
      return { repoUrl: trimmed };
    }
  }

  // Otherwise treat as code snippet
  return { code: combined };
}

// --- VLayer API calls ---

async function vlayerFetch(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${VLAYER_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${VLAYER_API_KEY}`,
      ...options.headers,
    },
    signal: AbortSignal.timeout(30_000),
  });
}

async function scanCode(code: string): Promise<VLayerScanResult> {
  const res = await vlayerFetch('/v1/scan', {
    method: 'POST',
    body: JSON.stringify({
      files: [{ filename: 'input.txt', content: code }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`VLayer scan failed (${res.status}): ${text}`);
  }

  return (await res.json()) as VLayerScanResult;
}

async function scanRepo(repoUrl: string): Promise<VLayerScanResult> {
  // Start async repo scan
  const startRes = await vlayerFetch('/v1/scan/repo', {
    method: 'POST',
    body: JSON.stringify({ url: repoUrl }),
  });

  if (!startRes.ok) {
    const text = await startRes.text();
    throw new Error(`VLayer repo scan failed (${startRes.status}): ${text}`);
  }

  const startData = (await startRes.json()) as VLayerRepoResponse;

  if (!startData.jobId) {
    // Might be a synchronous response
    return startData as unknown as VLayerScanResult;
  }

  // Poll for results
  const maxAttempts = 60; // 5 minutes max (5s intervals)
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(5_000);

    const pollRes = await vlayerFetch(`/v1/scan/${startData.jobId}`, { method: 'GET' });

    if (!pollRes.ok) {
      const text = await pollRes.text();
      throw new Error(`VLayer poll failed (${pollRes.status}): ${text}`);
    }

    const pollData = (await pollRes.json()) as VLayerPollResponse;

    if (pollData.status === 'completed' && pollData.result) {
      return pollData.result;
    }

    if (pollData.status === 'failed') {
      throw new Error(`VLayer repo scan failed: ${pollData.error ?? 'Unknown error'}`);
    }

    logger.info('Polling repo scan', { jobId: startData.jobId, status: pollData.status, attempt: i + 1 });
  }

  throw new Error('VLayer repo scan timed out after 5 minutes');
}

function formatReport(result: VLayerScanResult, input: string): string {
  const lines: string[] = ['# HIPAA Compliance Scan Report', ''];

  if (result.grade || result.score !== undefined) {
    lines.push('## Score');
    if (result.grade) lines.push(`**Grade:** ${result.grade}`);
    if (result.score !== undefined) lines.push(`**Score:** ${result.score}/100`);
    lines.push('');
  }

  if (result.summary) {
    lines.push('## Summary');
    const s = result.summary;
    if (s.critical) lines.push(`- **Critical:** ${s.critical}`);
    if (s.high) lines.push(`- **High:** ${s.high}`);
    if (s.medium) lines.push(`- **Medium:** ${s.medium}`);
    if (s.low) lines.push(`- **Low:** ${s.low}`);
    if (s.info) lines.push(`- **Info:** ${s.info}`);
    lines.push('');
  }

  if (result.findings && result.findings.length > 0) {
    lines.push('## Findings');
    for (const f of result.findings) {
      const loc = f.file ? ` (${f.file}${f.line ? `:${f.line}` : ''})` : '';
      lines.push(`- **[${f.severity.toUpperCase()}]** ${f.rule}${loc}`);
      lines.push(`  ${f.message}`);
    }
    lines.push('');
  } else {
    lines.push('## Findings');
    lines.push('No violations found.');
    lines.push('');
  }

  if (result.recommendations && result.recommendations.length > 0) {
    lines.push('## Recommendations');
    for (const r of result.recommendations) {
      lines.push(`- ${r}`);
    }
    lines.push('');
  }

  lines.push(`---`);
  lines.push(`*Scanned: ${input}*`);

  return lines.join('\n');
}

// --- RPC Handlers ---

async function handleMessageSend(
  id: string | number,
  params: Record<string, unknown>,
): Promise<{ jsonrpc: '2.0'; id: string | number; result?: TaskState; error?: { code: number; message: string } }> {
  const taskId = (params['id'] as string) ?? crypto.randomUUID();
  const message = params['message'] as
    | { role: string; parts: Array<{ type: string; data: unknown }> }
    | undefined;

  const input = extractInput(params);

  if (!input.repoUrl && !input.code) {
    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32602, message: 'No GitHub repo URL or code snippet provided to scan' },
    };
  }

  const inputLabel = input.repoUrl ?? 'code snippet';
  logger.info('Starting HIPAA scan', { taskId, type: input.repoUrl ? 'repo' : 'code', input: inputLabel });

  try {
    const result = input.repoUrl ? await scanRepo(input.repoUrl) : await scanCode(input.code!);

    const report = formatReport(result, inputLabel);

    const agentMessage = {
      role: 'agent' as const,
      parts: [{ type: 'text' as const, data: report }],
    };

    const task: TaskState = {
      id: taskId,
      status: 'completed',
      messages: [...(message ? [message] : []), agentMessage],
      artifacts: [{ parts: [{ type: 'text', data: report }] }],
    };

    tasks.set(taskId, task);
    logger.info('HIPAA scan completed', { taskId, score: result.score, grade: result.grade });

    return { jsonrpc: '2.0', id, result: task };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error('HIPAA scan failed', { taskId, error: errMsg });

    const failedTask: TaskState = {
      id: taskId,
      status: 'failed',
      messages: message ? [message] : [],
      artifacts: [],
    };

    tasks.set(taskId, failedTask);

    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32000, message: `HIPAA scan failed: ${errMsg}` },
    };
  }
}

function handleTasksGet(id: string | number, params: Record<string, unknown>) {
  const taskId = params['id'] as string | undefined;
  if (!taskId || !tasks.has(taskId)) {
    return {
      jsonrpc: '2.0' as const,
      id,
      error: { code: -32602, message: `Task not found: ${taskId}` },
    };
  }
  return {
    jsonrpc: '2.0' as const,
    id,
    result: tasks.get(taskId),
  };
}

// --- Server ---

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    return res.end();
  }

  // A2A Agent Card
  if (url.pathname === '/.well-known/agent.json' && req.method === 'GET') {
    return jsonResponse(res, 200, AGENT_CARD);
  }

  // Health check
  if (url.pathname === '/health' && req.method === 'GET') {
    return jsonResponse(res, 200, { status: 'ok', agent: 'vlayer-agent' });
  }

  // JSON-RPC endpoint
  if (req.method === 'POST' && (url.pathname === '/' || url.pathname === '/a2a')) {
    const body = await readBody(req);
    let rpcReq: JsonRpcRequest;

    try {
      rpcReq = JSON.parse(body) as JsonRpcRequest;
    } catch {
      return jsonResponse(res, 400, {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' },
      });
    }

    if (rpcReq.jsonrpc !== '2.0' || !rpcReq.method) {
      return jsonResponse(res, 400, {
        jsonrpc: '2.0',
        id: rpcReq.id ?? null,
        error: { code: -32600, message: 'Invalid Request' },
      });
    }

    logger.info('RPC request', { method: rpcReq.method, id: rpcReq.id });

    switch (rpcReq.method) {
      case 'message/send': {
        const response = await handleMessageSend(rpcReq.id, rpcReq.params ?? {});
        return jsonResponse(res, 200, response);
      }
      case 'tasks/get':
        return jsonResponse(res, 200, handleTasksGet(rpcReq.id, rpcReq.params ?? {}));
      default:
        return jsonResponse(res, 200, {
          jsonrpc: '2.0',
          id: rpcReq.id,
          error: { code: -32601, message: `Method not found: ${rpcReq.method}` },
        });
    }
  }

  jsonResponse(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  logger.info(`VLayer HIPAA Scanner listening on http://localhost:${PORT}`);
  logger.info(`Agent Card: http://localhost:${PORT}/.well-known/agent.json`);
  logger.info(`A2A endpoint: http://localhost:${PORT}/a2a`);
});
