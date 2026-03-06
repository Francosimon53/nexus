import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import Anthropic from '@anthropic-ai/sdk';
import { createLogger } from '@nexus-protocol/shared';

const PORT = parseInt(process.env['PORT'] ?? '4002', 10);
const ANTHROPIC_API_KEY = process.env['ANTHROPIC_API_KEY'];

if (!ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY environment variable');
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
const logger = createLogger('summarize-agent');

const AGENT_CARD = {
  name: 'NEXUS Summarizer',
  description: 'Summarizes any text or document into concise key points using Claude.',
  url: process.env['AGENT_URL'] ?? `http://localhost:${PORT}`,
  version: '1.0.0',
  capabilities: {
    streaming: false,
    pushNotifications: false,
    stateTransitionHistory: false,
  },
  skills: [
    {
      id: 'summarize',
      name: 'Summarize',
      description: 'Summarize any text or document into concise key points',
      tags: ['nlp', 'summarization', 'productivity'],
      examples: ['Summarize this article for me', 'Give me the key points of this document'],
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

function extractText(params: Record<string, unknown>): string {
  // Extract text from A2A message parts
  const message = params['message'] as
    | { role: string; parts: Array<{ type: string; data: unknown }> }
    | undefined;

  if (message?.parts) {
    const texts = message.parts
      .filter((p) => p.type === 'text')
      .map((p) => {
        const data = p.data;
        if (typeof data === 'string') {
          // Try to parse JSON-stringified input
          try {
            const parsed = JSON.parse(data) as unknown;
            if (typeof parsed === 'object' && parsed !== null && 'text' in parsed) {
              return String((parsed as { text: unknown }).text);
            }
            if (typeof parsed === 'string') return parsed;
            return JSON.stringify(parsed);
          } catch {
            return data;
          }
        }
        return String(data);
      });
    return texts.join('\n');
  }

  return '';
}

async function summarize(text: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Summarize the following text into concise key points. Be clear and brief.\n\n${text}`,
      },
    ],
  });

  const block = response.content[0];
  if (block && block.type === 'text') {
    return block.text;
  }
  return 'Unable to generate summary.';
}

async function handleMessageSend(
  id: string | number,
  params: Record<string, unknown>,
): Promise<{ jsonrpc: '2.0'; id: string | number; result?: TaskState; error?: { code: number; message: string } }> {
  const taskId = (params['id'] as string) ?? crypto.randomUUID();
  const message = params['message'] as
    | { role: string; parts: Array<{ type: string; data: unknown }> }
    | undefined;

  const inputText = extractText(params);

  if (!inputText.trim()) {
    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32602, message: 'No text provided to summarize' },
    };
  }

  logger.info('Summarizing text', { taskId, inputLength: inputText.length });

  try {
    const summary = await summarize(inputText);

    const agentMessage = {
      role: 'agent' as const,
      parts: [{ type: 'text' as const, data: summary }],
    };

    const task: TaskState = {
      id: taskId,
      status: 'completed',
      messages: [...(message ? [message] : []), agentMessage],
      artifacts: [{ parts: [{ type: 'text', data: summary }] }],
    };

    tasks.set(taskId, task);
    logger.info('Summary completed', { taskId, outputLength: summary.length });

    return { jsonrpc: '2.0', id, result: task };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error('Summarization failed', { taskId, error: errMsg });

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
      error: { code: -32000, message: `Summarization failed: ${errMsg}` },
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
    return jsonResponse(res, 200, { status: 'ok', agent: 'summarize-agent' });
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
  logger.info(`NEXUS Summarizer listening on http://localhost:${PORT}`);
  logger.info(`Agent Card: http://localhost:${PORT}/.well-known/agent.json`);
  logger.info(`A2A endpoint: http://localhost:${PORT}/a2a`);
});
