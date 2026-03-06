import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createLogger } from '@nexus-protocol/shared';

const PORT = parseInt(process.env['PORT'] ?? '4100', 10);
const logger = createLogger('echo-agent');

const AGENT_CARD = {
  name: 'Echo Agent',
  description: 'A simple A2A agent that echoes back any message it receives.',
  url: `http://localhost:${PORT}`,
  version: '1.0.0',
  capabilities: {
    streaming: false,
    pushNotifications: false,
    stateTransitionHistory: false,
  },
  skills: [
    {
      id: 'echo',
      name: 'Echo',
      description: 'Echoes back the input message',
      tags: ['utility', 'testing'],
      examples: ['Echo this message back to me'],
    },
  ],
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

// In-memory task store — state is lost on restart. For production agents,
// use a persistent store (database, Redis, etc.) instead.
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

function handleMessageSend(id: string | number, params: Record<string, unknown>) {
  const message = params['message'] as { role: string; parts: Array<{ type: string; data: unknown }> } | undefined;
  const taskId = (params['id'] as string) ?? crypto.randomUUID();

  const inputText = message?.parts
    ?.filter((p) => p.type === 'text')
    .map((p) => p.data)
    .join(' ') ?? '';

  const echoMessage = {
    role: 'agent',
    parts: [{ type: 'text', data: `Echo: ${inputText}` }],
  };

  const task: TaskState = {
    id: taskId,
    status: 'completed',
    messages: [...(message ? [message] : []), echoMessage],
    artifacts: [{ parts: [{ type: 'text', data: `Echo: ${inputText}` }] }],
  };

  tasks.set(taskId, task);

  return {
    jsonrpc: '2.0' as const,
    id,
    result: task,
  };
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

  // A2A Agent Card
  if (url.pathname === '/.well-known/agent.json' && req.method === 'GET') {
    return jsonResponse(res, 200, AGENT_CARD);
  }

  // Health check
  if (url.pathname === '/health' && req.method === 'GET') {
    return jsonResponse(res, 200, { status: 'ok', agent: 'echo-agent' });
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
  logger.info(`Echo Agent listening on http://localhost:${PORT}`);
  logger.info(`Agent Card: http://localhost:${PORT}/.well-known/agent.json`);
});
