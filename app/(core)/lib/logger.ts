import { randomUUID } from "crypto";

export type LogLevel = "info" | "error" | "warn" | "debug";

interface LogContext {
  traceId?: string;
  [key: string]: unknown;
}

const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  error: COLORS.red,
  warn: COLORS.yellow,
  info: COLORS.blue,
  debug: COLORS.cyan,
};

class Logger {
  generateTraceId(): string {
    return randomUUID();
  }

  private formatLog(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): string {
    const traceId = context?.traceId || this.generateTraceId();
    const timestamp = new Date().toISOString();
    
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      traceId,
      message,
      ...(context && { context: { ...context, traceId: undefined } }),
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      }),
    };

    return JSON.stringify(logEntry);
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    const logMessage = this.formatLog(level, message, context, error);
    const color = LEVEL_COLORS[level];
    switch (level) {
      case "error":
        console.error(color + logMessage + COLORS.reset);
        break;
      case "warn":
        console.warn(color + logMessage + COLORS.reset);
        break;
      case "debug":
        if (process.env.NODE_ENV === "development") {
          console.debug(color + logMessage + COLORS.reset);
        }
        break;
      default:
        console.log(color + logMessage + COLORS.reset);
    }
  }

  info(message: string, context?: LogContext): void {
    this.log("info", message, context);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.log("error", message, context, error);
  }

  warn(message: string, context?: LogContext): void {
    this.log("warn", message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.log("debug", message, context);
  }

  /**
   * Creates a child logger with a specific trace ID
   * This is useful for passing trace IDs through async operations
   */
  withTraceId(traceId: string): LoggerWithTrace {
    return new LoggerWithTrace(traceId);
  }
}

class LoggerWithTrace {
  constructor(private traceId: string) {}

  private formatLog(
    level: LogLevel,
    message: string,
    context?: Omit<LogContext, "traceId">,
    error?: Error
  ): string {
    const timestamp = new Date().toISOString();
    
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      traceId: this.traceId,
      message,
      ...(context && { context }),
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      }),
    };

    return JSON.stringify(logEntry);
  }

  private log(level: LogLevel, message: string, context?: Omit<LogContext, "traceId">, error?: Error): void {
    const logMessage = this.formatLog(level, message, context, error);
    const color = LEVEL_COLORS[level];
    switch (level) {
      case "error":
        console.error(color + logMessage + COLORS.reset);
        break;
      case "warn":
        console.warn(color + logMessage + COLORS.reset);
        break;
      case "debug":
        if (process.env.NODE_ENV === "development") {
          console.debug(color + logMessage + COLORS.reset);
        }
        break;
      default:
        console.log(color + logMessage + COLORS.reset);
    }
  }

  info(message: string, context?: Omit<LogContext, "traceId">): void {
    this.log("info", message, context);
  }

  error(message: string, error?: Error, context?: Omit<LogContext, "traceId">): void {
    this.log("error", message, context, error);
  }

  warn(message: string, context?: Omit<LogContext, "traceId">): void {
    this.log("warn", message, context);
  }

  debug(message: string, context?: Omit<LogContext, "traceId">): void {
    this.log("debug", message, context);
  }

  getTraceId(): string {
    return this.traceId;
  }
}

export const logger = new Logger();
