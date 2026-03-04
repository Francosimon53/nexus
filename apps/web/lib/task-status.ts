import type { TaskStatus, A2ATaskStatus } from '@nexus-protocol/shared';

const DB_TO_A2A: Record<TaskStatus, A2ATaskStatus> = {
  pending: 'submitted',
  assigned: 'submitted',
  running: 'working',
  completed: 'completed',
  failed: 'failed',
  cancelled: 'canceled',
};

const A2A_TO_DB: Record<A2ATaskStatus, TaskStatus> = {
  submitted: 'assigned',
  working: 'running',
  'input-required': 'running',
  completed: 'completed',
  failed: 'failed',
  canceled: 'cancelled',
};

const TERMINAL: Set<TaskStatus> = new Set(['completed', 'failed', 'cancelled']);

export function toA2AStatus(dbStatus: TaskStatus): A2ATaskStatus {
  return DB_TO_A2A[dbStatus];
}

export function toDbStatus(a2aStatus: A2ATaskStatus): TaskStatus {
  return A2A_TO_DB[a2aStatus];
}

export function isTerminal(dbStatus: TaskStatus): boolean {
  return TERMINAL.has(dbStatus);
}
