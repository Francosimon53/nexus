import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createLogger } from '@nexus-protocol/shared';

const PORT = parseInt(process.env['PORT'] ?? '4200', 10);
const logger = createLogger('secureagent');

const AGENT_CARD = {
  name: 'SecureAgent',
  description:
    'A multi-capability AI agent by secureagent.app — supports multi-channel chat, task scheduling, code generation, and browser automation.',
  url: process.env['AGENT_URL'] ?? `http://localhost:${PORT}`,
  version: '1.0.0',
  capabilities: {
    streaming: false,
    pushNotifications: false,
    stateTransitionHistory: true,
  },
  skills: [
    {
      id: 'multi-channel-chat',
      name: 'Multi-Channel AI Chat',
      description:
        'Conversational AI across multiple channels — web, Slack, Discord, and API. Context-aware responses with memory.',
      tags: ['chat', 'ai', 'conversational', 'multi-channel'],
      examples: ['Chat with me about project planning', 'Summarize this Slack thread'],
    },
    {
      id: 'task-scheduling',
      name: 'Task Scheduling',
      description:
        'Schedule, manage, and automate recurring tasks with cron-like precision. Supports dependencies and conditional triggers.',
      tags: ['scheduling', 'automation', 'tasks', 'cron'],
      examples: ['Schedule a daily report at 9am', 'Run this pipeline every Monday'],
    },
    {
      id: 'code-generation',
      name: 'Code Generation',
      description:
        'Generate, refactor, and review code across multiple languages. Supports full-file generation and targeted edits.',
      tags: ['code', 'generation', 'development', 'refactoring'],
      examples: ['Generate a REST API in TypeScript', 'Refactor this function for performance'],
    },
    {
      id: 'browser-automation',
      name: 'Browser Automation',
      description:
        'Automate browser interactions — navigate pages, fill forms, extract data, and take screenshots using headless browsers.',
      tags: ['browser', 'automation', 'scraping', 'testing'],
      examples: ['Scrape product prices from this URL', 'Fill out this form and submit'],
    },
  ],
  authentication: { schemes: ['bearer'] },
};

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

function resolveSkill(inputText: string): string {
  const lower = inputText.toLowerCase();
  if (/schedul|cron|recurring|automat.*task|remind/i.test(lower)) return 'task-scheduling';
  if (/code|generat|refactor|function|class|api|typescript|python/i.test(lower)) return 'code-generation';
  if (/browser|scrape|screenshot|navigate|click|form|headless/i.test(lower)) return 'browser-automation';
  return 'multi-channel-chat';
}

function handleMessageSend(id: string | number, params: Record<string, unknown>) {
  const message = params['message'] as
    | { role: string; parts: Array<{ type: string; data: unknown }> }
    | undefined;
  const taskId = (params['id'] as string) ?? crypto.randomUUID();

  const inputText =
    message?.parts
      ?.filter((p) => p.type === 'text')
      .map((p) => p.data)
      .join(' ') ?? '';

  const skill = resolveSkill(inputText);
  logger.info('Resolved skill', { skill, taskId });

  const responseText = `[SecureAgent:${skill}] Received: ${inputText}`;

  const agentMessage = {
    role: 'agent',
    parts: [{ type: 'text', data: responseText }],
  };

  const task: TaskState = {
    id: taskId,
    status: 'completed',
    messages: [...(message ? [message] : []), agentMessage],
    artifacts: [
      {
        parts: [
          { type: 'text', data: responseText },
          { type: 'data', data: { skill, agent: 'secureagent', version: '1.0.0' } },
        ],
      },
    ],
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

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  // A2A Agent Card
  if (url.pathname === '/.well-known/agent.json' && req.method === 'GET') {
    return jsonResponse(res, 200, AGENT_CARD);
  }

  // Health check
  if (url.pathname === '/health' && req.method === 'GET') {
    return jsonResponse(res, 200, { status: 'ok', agent: 'secureagent' });
  }

  // JSON-RPC endpoint
  if (req.method === 'POST' && (url.pathname === '/' || url.pathname === '/rpc')) {
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
        return jsonResponse(res, 200, handleMessageSend(rpcReq.id, rpcReq.params ?? {}));
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
  logger.info(`SecureAgent listening on http://localhost:${PORT}`);
  logger.info(`Agent Card: http://localhost:${PORT}/.well-known/agent.json`);
});
