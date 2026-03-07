import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createLogger } from '@nexus-protocol/shared';

const PORT = parseInt(process.env['PORT'] ?? '4400', 10);
const OPENCLAW_URL = process.env['OPENCLAW_AGENT_URL'] ?? 'http://localhost:3000';
const AGENT_URL = process.env['AGENT_URL'] ?? `http://localhost:${PORT}`;

const logger = createLogger('simon-assistant');

// --- A2A Agent Card ---
const AGENT_CARD = {
  name: 'Simon Assistant',
  description:
    'A production OpenClaw personal agent running 24/7 on a Hostinger VPS with 26+ skills including web search, browser automation, image generation, audio transcription, video processing, marketing strategy, weather, health checks, and proactive monitoring. Accessible via Telegram @Simon_Assistant_bot. Features uptime monitoring, Reddit alerts, and morning briefings.',
  url: AGENT_URL,
  version: '1.0.0',
  capabilities: {
    streaming: false,
    pushNotifications: false,
    stateTransitionHistory: false,
  },
  skills: [
    {
      id: 'web-search',
      name: 'Web Search',
      description: 'Search the web via Brave API and return structured results',
      tags: ['search', 'web', 'brave'],
      examples: ['Search for the latest AI news'],
    },
    {
      id: 'browser-automation',
      name: 'Browser Automation',
      description: 'Navigate websites, take screenshots, click elements, fill forms',
      tags: ['browser', 'automation', 'scraping'],
      examples: ['Take a screenshot of example.com'],
    },
    {
      id: 'image-generation',
      name: 'Image Generation',
      description: 'Generate images with DALL-E (prompt to image)',
      tags: ['image', 'generation', 'dall-e', 'media'],
      examples: ['Generate an image of a sunset over mountains'],
    },
    {
      id: 'audio-transcription',
      name: 'Audio Transcription',
      description: 'Transcribe audio files via OpenAI Whisper',
      tags: ['audio', 'transcription', 'whisper', 'media'],
      examples: ['Transcribe this audio file'],
    },
    {
      id: 'video-processing',
      name: 'Video Processing',
      description: 'Extract frames from videos at specific timestamps',
      tags: ['video', 'frames', 'media', 'processing'],
      examples: ['Extract a frame at 2:30 from this video'],
    },
    {
      id: 'marketing-strategy',
      name: 'Marketing Strategy',
      description:
        '23 marketing strategies: SEO, copywriting, ads, conversion optimization',
      tags: ['marketing', 'seo', 'copywriting', 'ads', 'strategy'],
      examples: ['Create an SEO strategy for my SaaS product'],
    },
    {
      id: 'text-humanizer',
      name: 'Text Humanizer',
      description: 'Detect and rewrite AI-generated text to sound human',
      tags: ['text', 'humanizer', 'rewriting', 'ai-detection'],
      examples: ['Rewrite this paragraph to sound more natural'],
    },
    {
      id: 'weather-lookup',
      name: 'Weather Lookup',
      description: 'Current weather and forecast for any location',
      tags: ['weather', 'forecast', 'location'],
      examples: ['What is the weather in Miami?'],
    },
    {
      id: 'security-audit',
      name: 'Security Audit',
      description: 'Run security health checks on hosts and infrastructure',
      tags: ['security', 'audit', 'health-check', 'infrastructure'],
      examples: ['Run a security check on my server'],
    },
    {
      id: 'avatar-video',
      name: 'Avatar Video',
      description: 'Create AI avatar videos with HeyGen',
      tags: ['avatar', 'video', 'heygen', 'media'],
      examples: ['Create an avatar video with this script'],
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

// --- Helpers ---

const tasks = new Map<string, TaskState>();

function jsonResponse(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
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

// --- OpenClaw Proxy ---

async function forwardToOpenClaw(inputText: string): Promise<string> {
  logger.info('Forwarding to OpenClaw', { url: OPENCLAW_URL, inputLength: inputText.length });

  const res = await fetch(OPENCLAW_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: inputText }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OpenClaw returned ${res.status}: ${errText}`);
  }

  const data = (await res.json()) as Record<string, unknown>;

  const result =
    data['response'] ?? data['result'] ?? data['message'] ?? data['output'] ?? data['text'];

  return typeof result === 'string' ? result : JSON.stringify(data);
}

// --- A2A Handlers ---

async function handleMessageSend(id: string | number, params: Record<string, unknown>) {
  const message = params['message'] as
    | { role: string; parts: Array<{ type: string; data: unknown }> }
    | undefined;
  const taskId = (params['id'] as string) ?? crypto.randomUUID();

  const inputText =
    message?.parts
      ?.filter((p) => p.type === 'text')
      .map((p) => p.data)
      .join(' ') ?? '';

  let responseText: string;
  let status: string;

  try {
    responseText = await forwardToOpenClaw(inputText);
    status = 'completed';
  } catch (err) {
    responseText = `Error: ${err instanceof Error ? err.message : String(err)}`;
    status = 'failed';
    logger.error('OpenClaw forwarding failed', { error: responseText });
  }

  const agentMessage = {
    role: 'agent',
    parts: [{ type: 'text', data: responseText }],
  };

  const task: TaskState = {
    id: taskId,
    status,
    messages: [...(message ? [message] : []), agentMessage],
    artifacts:
      status === 'completed'
        ? [{ parts: [{ type: 'text', data: responseText }] }]
        : [],
  };

  tasks.set(taskId, task);

  return { jsonrpc: '2.0' as const, id, result: task };
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
  return { jsonrpc: '2.0' as const, id, result: tasks.get(taskId) };
}

// --- Server ---

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  // A2A Agent Card
  if (url.pathname === '/.well-known/agent.json' && req.method === 'GET') {
    return jsonResponse(res, 200, AGENT_CARD);
  }

  // Health check
  if (url.pathname === '/health' && req.method === 'GET') {
    return jsonResponse(res, 200, { status: 'ok', agent: 'simon-assistant', upstream: OPENCLAW_URL });
  }

  // JSON-RPC endpoint (A2A)
  if (req.method === 'POST' && (url.pathname === '/' || url.pathname === '/rpc' || url.pathname === '/a2a')) {
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
      case 'message/send':
        return jsonResponse(res, 200, await handleMessageSend(rpcReq.id, rpcReq.params ?? {}));
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
  logger.info(`Simon Assistant adapter listening on http://localhost:${PORT}`);
  logger.info(`Agent Card: http://localhost:${PORT}/.well-known/agent.json`);
  logger.info(`Upstream OpenClaw agent: ${OPENCLAW_URL}`);
});
