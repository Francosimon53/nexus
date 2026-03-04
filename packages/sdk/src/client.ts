import type { Agent, Task, TrustEvent } from '@nexus-protocol/shared';
import { NexusError } from '@nexus-protocol/shared';

export interface NexusClientConfig {
  apiKey: string;
  baseUrl?: string;
}

async function request<T>(
  baseUrl: string,
  apiKey: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const error = (await res.json().catch(() => ({}))) as {
      error?: { code?: string; message?: string };
    };
    throw new NexusError(
      (error.error?.code as ConstructorParameters<typeof NexusError>[0]) ?? 'INTERNAL_ERROR',
      error.error?.message ?? `Request failed: ${res.status}`,
      res.status,
    );
  }

  return res.json() as Promise<T>;
}

export class AgentService {
  constructor(
    private baseUrl: string,
    private apiKey: string,
  ) {}

  async register(data: {
    name: string;
    description?: string;
    endpoint: string;
    skills?: Agent['skills'];
    tags?: string[];
  }): Promise<Agent> {
    return request<Agent>(this.baseUrl, this.apiKey, 'POST', '/v1/agents', data);
  }

  async get(agentId: string): Promise<Agent> {
    return request<Agent>(this.baseUrl, this.apiKey, 'GET', `/v1/agents/${agentId}`);
  }

  async discover(params?: { tags?: string[]; status?: string }): Promise<Agent[]> {
    const query = new URLSearchParams();
    if (params?.tags) query.set('tags', params.tags.join(','));
    if (params?.status) query.set('status', params.status);
    const qs = query.toString();
    return request<Agent[]>(this.baseUrl, this.apiKey, 'GET', `/v1/agents${qs ? `?${qs}` : ''}`);
  }

  async update(agentId: string, data: Partial<Pick<Agent, 'name' | 'description' | 'endpoint' | 'skills' | 'tags' | 'metadata'>>): Promise<Agent> {
    return request<Agent>(this.baseUrl, this.apiKey, 'PATCH', `/v1/agents/${agentId}`, data);
  }

  async delete(agentId: string): Promise<void> {
    await request<void>(this.baseUrl, this.apiKey, 'DELETE', `/v1/agents/${agentId}`);
  }

  async heartbeat(agentId: string): Promise<{ status: string }> {
    return request<{ status: string }>(
      this.baseUrl,
      this.apiKey,
      'POST',
      `/v1/agents/${agentId}/heartbeat`,
    );
  }
}

export class TaskService {
  constructor(
    private baseUrl: string,
    private apiKey: string,
  ) {}

  async create(data: {
    title: string;
    description?: string;
    requesterAgentId: string;
    assignedAgentId?: string;
    input?: Record<string, unknown>;
    maxBudgetCredits?: number;
  }): Promise<Task> {
    return request<Task>(this.baseUrl, this.apiKey, 'POST', '/v1/tasks', data);
  }

  async get(taskId: string): Promise<Task> {
    return request<Task>(this.baseUrl, this.apiKey, 'GET', `/v1/tasks/${taskId}`);
  }

  async cancel(taskId: string): Promise<Task> {
    return request<Task>(this.baseUrl, this.apiKey, 'POST', `/v1/tasks/${taskId}/cancel`);
  }

  async *stream(taskId: string): AsyncGenerator<{ event: string; data: unknown }> {
    const res = await fetch(`${this.baseUrl}/v1/tasks/${taskId}/stream`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'text/event-stream',
      },
    });

    if (!res.ok || !res.body) {
      throw new NexusError('INTERNAL_ERROR', `Stream failed: ${res.status}`, res.status);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let currentEvent = 'message';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const raw = line.slice(6);
            try {
              yield { event: currentEvent, data: JSON.parse(raw) };
            } catch {
              yield { event: currentEvent, data: raw };
            }
            currentEvent = 'message';
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

export class TrustService {
  constructor(
    private baseUrl: string,
    private apiKey: string,
  ) {}

  async getProfile(agentId: string): Promise<{
    agentId: string;
    trustScore: number;
    recentEvents: TrustEvent[];
  }> {
    return request(this.baseUrl, this.apiKey, 'GET', `/v1/trust/${agentId}`);
  }

  async rate(agentId: string, data: { score: number; reason?: string }): Promise<TrustEvent> {
    return request<TrustEvent>(this.baseUrl, this.apiKey, 'POST', `/v1/trust/${agentId}/rate`, data);
  }
}

export class NexusClient {
  public readonly agents: AgentService;
  public readonly tasks: TaskService;
  public readonly trust: TrustService;

  constructor(config: NexusClientConfig) {
    const baseUrl = (config.baseUrl ?? 'https://api.nexus-protocol.dev').replace(/\/+$/, '');
    this.agents = new AgentService(baseUrl, config.apiKey);
    this.tasks = new TaskService(baseUrl, config.apiKey);
    this.trust = new TrustService(baseUrl, config.apiKey);
  }
}
