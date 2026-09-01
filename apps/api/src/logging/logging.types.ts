/**
 * Diagnostic-log shapes (SPEC §5.7). Framework-free: this is an on-disk forensic
 * record, not part of the cross-app contract in `@tribunal/shared-types`.
 */

/** Ordered by severity: `info` < `warn` < `error` (used for `LOG_LEVEL` gating). */
export type LogLevel = 'info' | 'warn' | 'error';

/** The kinds of entries the backend emits (SPEC §5.7). */
export type LogEvent =
  | 'openrouter.call'
  | 'run.lifecycle'
  | 'run.swap'
  | 'error.unhandled';

/** A serialized error, safe to write as JSON. */
export interface LogError {
  name: string;
  message: string;
  stack?: string;
}

/**
 * One JSONL line. Fields not relevant to an entry's `event` are omitted
 * (`JSON.stringify` drops `undefined`), so lines stay compact.
 */
export interface LogEntry {
  ts: string;
  level: LogLevel;
  event: LogEvent;
  runId?: string | null;
  personaKey?: string | null;
  model?: string | null;
  status?: number | null;
  latencyMs?: number | null;
  attempt?: number | null;
  /** Free-form token usage from an OpenRouter call. */
  usage?: unknown;
  error?: LogError;
  /** Full OpenRouter request payload (secrets stripped). */
  request?: unknown;
  /** Full response body, or the raw error text on a non-2xx. */
  response?: unknown;
  message?: string;
}
