import { z } from 'zod';

// ── A2A Protocol Types ─────────────────────────────────────────────────────────
// (Placed first because AgentSchema references AgentCardSchema)

export const A2ASkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  tags: z.array(z.string()).default([]),
  examples: z.array(z.string()).default([]),
});

export type A2ASkill = z.infer<typeof A2ASkillSchema>;

export const AgentCardSchema = z.object({
  name: z.string(),
  description: z.string(),
  url: z.string().url(),
  version: z.string().default('1.0.0'),
  capabilities: z.object({
    streaming: z.boolean().default(false),
    pushNotifications: z.boolean().default(false),
    stateTransitionHistory: z.boolean().default(false),
  }),
  skills: z.array(A2ASkillSchema).default([]),
  authentication: z
    .object({
      schemes: z.array(z.string()),
    })
    .optional(),
});

export type AgentCard = z.infer<typeof AgentCardSchema>;

export const A2AArtifactSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  parts: z.array(
    z.object({
      type: z.string(),
      data: z.unknown(),
    }),
  ),
});

export type A2AArtifact = z.infer<typeof A2AArtifactSchema>;

export const A2ATaskStatusEnum = z.enum([
  'submitted',
  'working',
  'input-required',
  'completed',
  'canceled',
  'failed',
]);
export type A2ATaskStatus = z.infer<typeof A2ATaskStatusEnum>;

export const A2AMessageSchema = z.object({
  role: z.enum(['user', 'agent']),
  parts: z.array(
    z.object({
      type: z.string(),
      data: z.unknown(),
    }),
  ),
});

export type A2AMessage = z.infer<typeof A2AMessageSchema>;

// ── Agent ──────────────────────────────────────────────────────────────────────

export const AgentSkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  inputSchema: z.record(z.unknown()).optional(),
  outputSchema: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).default([]),
});

export type AgentSkill = z.infer<typeof AgentSkillSchema>;

export const AgentStatusEnum = z.enum(['online', 'offline', 'degraded']);
export type AgentStatus = z.infer<typeof AgentStatusEnum>;

export const AgentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(1000).default(''),
  ownerUserId: z.string().uuid(),
  endpoint: z.string().url(),
  status: AgentStatusEnum.default('offline'),
  skills: z.array(AgentSkillSchema).default([]),
  tags: z.array(z.string()).default([]),
  trustScore: z.number().min(0).max(100).default(50),
  metadata: z.record(z.unknown()).default({}),
  agentCard: AgentCardSchema.optional(),
  lastHeartbeat: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Agent = z.infer<typeof AgentSchema>;

// ── Registration / Discovery / Heartbeat ─────────────────────────────────────

export const RegisterAgentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).default(''),
  endpoint: z.string().url(),
  skills: z.array(AgentSkillSchema).default([]),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
});

export type RegisterAgentInput = z.infer<typeof RegisterAgentSchema>;

export const DiscoverAgentsQuerySchema = z.object({
  skillTags: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').map((s) => s.trim()) : undefined)),
  category: z.string().optional(),
  minTrustScore: z.coerce.number().min(0).max(100).optional(),
  status: AgentStatusEnum.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type DiscoverAgentsQuery = z.infer<typeof DiscoverAgentsQuerySchema>;

export const HeartbeatSchema = z.object({
  status: AgentStatusEnum.optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type HeartbeatInput = z.infer<typeof HeartbeatSchema>;

// ── Task ───────────────────────────────────────────────────────────────────────

export const TaskStatusEnum = z.enum([
  'pending',
  'assigned',
  'running',
  'completed',
  'failed',
  'cancelled',
]);
export type TaskStatus = z.infer<typeof TaskStatusEnum>;

export const TaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().default(''),
  status: TaskStatusEnum.default('pending'),
  requesterAgentId: z.string().uuid(),
  assignedAgentId: z.string().uuid().nullable().default(null),
  input: z.record(z.unknown()).default({}),
  output: z.record(z.unknown()).nullable().default(null),
  messages: z.array(A2AMessageSchema).default([]),
  artifacts: z.array(A2AArtifactSchema).default([]),
  maxBudgetCredits: z.number().nonnegative().default(0),
  actualCostCredits: z.number().nonnegative().default(0),
  timeoutAt: z.string().datetime().nullable().default(null),
  retryCount: z.number().int().nonnegative().default(0),
  errorMessage: z.string().nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable().default(null),
});

export type Task = z.infer<typeof TaskSchema>;

// ── Task Creation / Reply ────────────────────────────────────────────────────

export const CreateTaskSchema = z.object({
  assignedAgentId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(''),
  input: z.record(z.unknown()).default({}),
  timeoutSeconds: z.number().int().min(10).max(3600).default(300),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const TaskReplySchema = z.object({
  message: A2AMessageSchema,
  artifacts: z.array(A2AArtifactSchema).optional(),
});

export type TaskReplyInput = z.infer<typeof TaskReplySchema>;

export const JsonRpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  method: z.string(),
  params: z.record(z.unknown()).optional(),
});

export type JsonRpcRequest = z.infer<typeof JsonRpcRequestSchema>;

// ── Workflow ───────────────────────────────────────────────────────────────────

export const WorkflowStepSchema = z.object({
  agentId: z.string().uuid(),
  skillId: z.string(),
  input: z.record(z.unknown()).default({}),
  dependsOn: z.array(z.number().int().nonnegative()).default([]),
});

export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

export const WorkflowSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  ownerUserId: z.string().uuid(),
  steps: z.array(WorkflowStepSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Workflow = z.infer<typeof WorkflowSchema>;

// ── Trust ──────────────────────────────────────────────────────────────────────

export const TrustEventTypeEnum = z.enum([
  'task_completed',
  'task_failed',
  'rating_received',
  'dispute_opened',
  'dispute_resolved',
]);
export type TrustEventType = z.infer<typeof TrustEventTypeEnum>;

export const TrustEventSchema = z.object({
  id: z.string().uuid(),
  agentId: z.string().uuid(),
  eventType: TrustEventTypeEnum,
  score: z.number().min(-10).max(10),
  reason: z.string().default(''),
  createdAt: z.string().datetime(),
});

export type TrustEvent = z.infer<typeof TrustEventSchema>;

// ── Billing ────────────────────────────────────────────────────────────────────

export const TransactionSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  fromAgentId: z.string().uuid(),
  toAgentId: z.string().uuid(),
  amountCredits: z.number().nonnegative(),
  status: z.enum(['pending', 'settled', 'refunded']).default('pending'),
  createdAt: z.string().datetime(),
});

export type Transaction = z.infer<typeof TransactionSchema>;

// ── API Key ────────────────────────────────────────────────────────────────────

export const ApiKeySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1).max(100),
  keyHash: z.string(),
  prefix: z.string().max(12),
  scopes: z.array(z.string()).default(['*']),
  lastUsedAt: z.string().datetime().nullable().default(null),
  expiresAt: z.string().datetime().nullable().default(null),
  createdAt: z.string().datetime(),
});

export type ApiKey = z.infer<typeof ApiKeySchema>;
