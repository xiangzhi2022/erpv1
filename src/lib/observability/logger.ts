import { redactSecrets } from './redact';

export interface StructuredLogger {
  error(event: string, context?: Record<string, unknown>): void;
  info(event: string, context?: Record<string, unknown>): void;
}

type LogSink = (line: string) => void;

export function createLogger(errorSink: LogSink = console.error): StructuredLogger {
  function write(
    level: 'error' | 'info',
    event: string,
    context: Record<string, unknown> = {},
  ) {
    const payload = redactSecrets({
      timestamp: new Date().toISOString(),
      level,
      event,
      ...context,
    });
    const line = JSON.stringify(payload);
    if (level === 'error') errorSink(line);
    else console.info(line);
  }

  return {
    error: (event, context) => write('error', event, context),
    info: (event, context) => write('info', event, context),
  };
}

export const logger = createLogger();
