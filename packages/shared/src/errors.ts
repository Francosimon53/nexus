export type NexusErrorCode =
  | 'AGENT_NOT_FOUND'
  | 'AGENT_OFFLINE'
  | 'TASK_NOT_FOUND'
  | 'TASK_ALREADY_ASSIGNED'
  | 'TASK_CANCELLED'
  | 'INSUFFICIENT_CREDITS'
  | 'TRUST_THRESHOLD_NOT_MET'
  | 'RATE_LIMIT_EXCEEDED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR'
  | 'PROTOCOL_ERROR';

export class NexusError extends Error {
  public readonly code: NexusErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: NexusErrorCode,
    message: string,
    statusCode = 500,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'NexusError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
      },
    };
  }
}

export class AgentNotFoundError extends NexusError {
  constructor(agentId: string) {
    super('AGENT_NOT_FOUND', `Agent not found: ${agentId}`, 404);
  }
}

export class TaskNotFoundError extends NexusError {
  constructor(taskId: string) {
    super('TASK_NOT_FOUND', `Task not found: ${taskId}`, 404);
  }
}

export class UnauthorizedError extends NexusError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401);
  }
}

export class ForbiddenError extends NexusError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', message, 403);
  }
}

export class ValidationError extends NexusError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

export class InsufficientCreditsError extends NexusError {
  constructor() {
    super('INSUFFICIENT_CREDITS', 'Insufficient credits for this operation', 402);
  }
}

export class RateLimitError extends NexusError {
  constructor(retryAfterSeconds?: number) {
    super('RATE_LIMIT_EXCEEDED', 'Rate limit exceeded', 429, {
      ...(retryAfterSeconds !== undefined ? { retryAfter: retryAfterSeconds } : {}),
    });
  }
}
