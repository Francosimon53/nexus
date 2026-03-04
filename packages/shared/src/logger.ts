export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  [key: string]: unknown;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class Logger {
  private context: string;
  private minLevel: LogLevel;

  constructor(context: string, minLevel: LogLevel = 'info') {
    this.context = context;
    this.minLevel = minLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.minLevel];
  }

  private emit(level: LogLevel, message: string, extra?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.context,
      ...extra,
    };

    const output = JSON.stringify(entry);

    if (level === 'error') {
      console.error(output);
    } else if (level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  debug(message: string, extra?: Record<string, unknown>): void {
    this.emit('debug', message, extra);
  }

  info(message: string, extra?: Record<string, unknown>): void {
    this.emit('info', message, extra);
  }

  warn(message: string, extra?: Record<string, unknown>): void {
    this.emit('warn', message, extra);
  }

  error(message: string, extra?: Record<string, unknown>): void {
    this.emit('error', message, extra);
  }

  child(subContext: string): Logger {
    return new Logger(`${this.context}:${subContext}`, this.minLevel);
  }
}

export function createLogger(context: string, minLevel?: LogLevel): Logger {
  return new Logger(context, minLevel);
}
