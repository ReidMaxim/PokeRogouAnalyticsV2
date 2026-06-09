import { MESSAGE_SOURCE } from "./constants";
import type { ExtensionMessage } from "./types";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_STYLES: Record<LogLevel, string> = {
  debug: "color:#8ab4f8",
  info: "color:#81c995",
  warn: "color:#fdd663",
  error: "color:#f28b82",
};

export interface LoggerOptions {
  scope: string;
  debugEnabled?: boolean;
}

export class Logger {
  private readonly scope: string;
  private debugEnabled: boolean;

  constructor(options: LoggerOptions) {
    this.scope = options.scope;
    this.debugEnabled = options.debugEnabled ?? true;
  }

  setDebugEnabled(enabled: boolean): void {
    this.debugEnabled = enabled;
  }

  debug(message: string, data?: unknown): void {
    if (!this.debugEnabled) {
      return;
    }
    this.emit("debug", message, data);
  }

  info(message: string, data?: unknown): void {
    this.emit("info", message, data);
  }

  warn(message: string, data?: unknown): void {
    this.emit("warn", message, data);
  }

  error(message: string, data?: unknown): void {
    this.emit("error", message, data);
  }

  group(title: string): void {
    console.groupCollapsed(`%c[PokéRogue Analytics][${this.scope}] ${title}`, LOG_STYLES.info);
  }

  groupEnd(): void {
    console.groupEnd();
  }

  table(label: string, rows: unknown): void {
    console.log(`%c[PokéRogue Analytics][${this.scope}] ${label}`, LOG_STYLES.info);
    console.table(rows);
  }

  private emit(level: LogLevel, message: string, data?: unknown): void {
    const prefix = `%c[PokéRogue Analytics][${this.scope}] ${message}`;
    if (data === undefined) {
      console[level](prefix, LOG_STYLES[level]);
      return;
    }
    console[level](prefix, LOG_STYLES[level], data);
  }
}

export function createLogger(scope: string, debugEnabled = true): Logger {
  return new Logger({ scope, debugEnabled });
}

export function sendRuntimeMessage<T = unknown>(
  message: ExtensionMessage<T>,
): Promise<unknown> {
  return chrome.runtime.sendMessage(message).catch((error: unknown) => {
    createLogger("messaging").warn("Runtime message failed", {
      type: message.type,
      error,
    });
    return undefined;
  });
}

const EXTENSION_SOURCES = new Set<string>(Object.values(MESSAGE_SOURCE));

export function isExtensionMessage(value: unknown): value is ExtensionMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as ExtensionMessage;
  return (
    typeof candidate.source === "string" &&
    typeof candidate.type === "string" &&
    EXTENSION_SOURCES.has(candidate.source)
  );
}
