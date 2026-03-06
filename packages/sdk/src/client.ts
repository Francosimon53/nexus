import type { Agent, Task, TrustEvent, CreditPackageId, Workflow, WorkflowRun, CreateWorkflowInput, TaskReplyInput } from '@nexus-protocol/shared';
import { NexusError } from '@nexus-protocol/shared';

export interface NexusClientConfig {
  apiKey: string;
  baseUrl?: string;
  /** Max retries for 5xx / network errors (default 3) */
  maxRetries?: number;
}

const DEFAULT_MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;
const RETRYABLE_STATUS = new Set([502, 503, 504, 429]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type RequestFn = <T>(method: string, path: string, body?: unknown) => Promise<T>;

function createRequestFn(baseUrl: string, apiKey: string, maxRetries: number): RequestFn {
  return async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        await sleep(RETRY_BASE_MS * Math.pow(2, attempt - 1));
      }

      let res: Response;
      try {
        res = await fetch(`${baseUrl}${path}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries) continue;
        throw new NexusError('INTERNAL_ERROR', `Network error: ${err instanceof Error ? err.message : String(err)}`, 0);
      }

      if (res.ok) {
        return res.json() as Promise<T>;
      }

      if (RETRYABLE_STATUS.has(res.status) && attempt < maxRetries) {
        lastError = new Error(`HTTP ${res.status}`);
        continue;
      }

      const error = (await res.json().catch(() => ({}))) as {
        error?: { code?: string; message?: string };
      };
      throw new NexusError(
        (error.error?.code as ConstructorParameters<typeof NexusError>[0]) ?? 'INTERNAL_ERROR',
        error.error?.message ?? `Request failed: ${res.status}`,
        res.status,
      );
    }

    throw lastError ?? new NexusError('INTERNAL_ERROR', 'Request failed after retries', 0);
  };
}

export class AgentService {
  constructor(private req: RequestFn) {}

  async register(data: {
    name: string;
    description?: string;
    endpoint: string;
    skills?: Agent['skills'];
    tags?: string[];
  }): Promise<Agent> {
    return this.req<Agent>('POST', '/v1/agents', data);
  }

  async get(agentId: string): Promise<Agent> {
    return this.req<Agent>('GET', `/v1/agents/${agentId}`);
  }

  async discover(params?: { tags?: string[]; status?: string }): Promise<Agent[]> {
    const query = new URLSearchParams();
    if (params?.tags) query.set('tags', params.tags.join(','));
    if (params?.status) query.set('status', params.status);
    const qs = query.toString();
    return this.req<Agent[]>('GET', `/v1/agents${qs ? `?${qs}` : ''}`);
  }

  async update(agentId: string, data: Partial<Pick<Agent, 'name' | 'description' | 'endpoint' | 'skills' | 'tags' | 'metadata'>>): Promise<Agent> {
    return this.req<Agent>('PATCH', `/v1/agents/${agentId}`, data);
  }

  async delete(agentId: string): Promise<void> {
    await this.req<void>('DELETE', `/v1/agents/${agentId}`);
  }

  async heartbeat(agentId: string): Promise<{ status: string }> {
    return this.req<{ status: string }>('POST', `/v1/agents/${agentId}/heartbeat`);
  }
}

export class TaskService {
  constructor(
    private req: RequestFn,
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
    return this.req<Task>('POST', '/v1/tasks', data);
  }

  async get(taskId: string): Promise<Task> {
    return this.req<Task>('GET', `/v1/tasks/${taskId}`);
  }

  async cancel(taskId: string): Promise<Task> {
    return this.req<Task>('POST', `/v1/tasks/${taskId}/cancel`);
  }

  async reply(taskId: string, data: TaskReplyInput): Promise<Task> {
    return this.req<Task>('POST', `/v1/tasks/${taskId}/reply`, data);
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
  constructor(private req: RequestFn) {}

  async getProfile(agentId: string): Promise<{
    agentId: string;
    trustScore: number;
    recentEvents: TrustEvent[];
  }> {
    return this.req('GET', `/v1/trust/${agentId}`);
  }

  async rate(agentId: string, data: { score: number; reason?: string }): Promise<TrustEvent> {
    return this.req<TrustEvent>('POST', `/v1/trust/${agentId}/rate`, data);
  }
}

export class BillingService {
  constructor(private req: RequestFn) {}

  async getBalance(): Promise<{
    user_id: string;
    balance: number;
    total_earned: number;
    total_spent: number;
    total_purchased: number;
  }> {
    return this.req('GET', '/v1/billing/balance');
  }

  async getTransactions(params?: {
    limit?: number;
    offset?: number;
    type?: string;
  }): Promise<{ transactions: unknown[]; total: number; limit: number; offset: number }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    if (params?.type) query.set('type', params.type);
    const qs = query.toString();
    return this.req('GET', `/v1/billing/transactions${qs ? `?${qs}` : ''}`);
  }

  async getUsage(period?: '7d' | '30d' | '90d'): Promise<{
    period: string;
    daily: { date: string; spent: number; earned: number }[];
    totalSpent: number;
    totalEarned: number;
  }> {
    const qs = period ? `?period=${period}` : '';
    return this.req('GET', `/v1/billing/usage${qs}`);
  }

  async createCheckout(packageId: CreditPackageId): Promise<{ url: string }> {
    return this.req('POST', '/v1/billing/checkout', { packageId });
  }
}

export class WorkflowService {
  constructor(private req: RequestFn) {}

  async create(data: CreateWorkflowInput): Promise<Workflow> {
    return this.req<Workflow>('POST', '/v1/workflows', data);
  }

  async list(): Promise<Workflow[]> {
    return this.req<Workflow[]>('GET', '/v1/workflows');
  }

  async get(workflowId: string): Promise<Workflow & { runs: WorkflowRun[] }> {
    return this.req<Workflow & { runs: WorkflowRun[] }>('GET', `/v1/workflows/${workflowId}`);
  }

  async execute(workflowId: string): Promise<WorkflowRun> {
    return this.req<WorkflowRun>('POST', `/v1/workflows/${workflowId}/execute`);
  }
}

export class NexusClient {
  public readonly agents: AgentService;
  public readonly tasks: TaskService;
  public readonly trust: TrustService;
  public readonly billing: BillingService;
  public readonly workflows: WorkflowService;

  constructor(config: NexusClientConfig) {
    const baseUrl = (config.baseUrl ?? 'https://api.nexus-protocol.dev').replace(/\/+$/, '');
    const retries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    const req = createRequestFn(baseUrl, config.apiKey, retries);
    this.agents = new AgentService(req);
    this.tasks = new TaskService(req, baseUrl, config.apiKey);
    this.trust = new TrustService(req);
    this.billing = new BillingService(req);
    this.workflows = new WorkflowService(req);
  }
}
