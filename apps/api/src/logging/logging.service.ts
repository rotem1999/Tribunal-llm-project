import { appendFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { redact } from './redact';
import type { LogEntry, LogError, LogLevel } from './logging.types';

/** Severity rank for `LOG_LEVEL` gating (SPEC §5.7). */
const LEVEL_RANK: Record<LogLevel, number> = { info: 0, warn: 1, error: 2 };

/**
 * The diagnostic logging sink (SPEC §5.7). Writes one JSON object per line to a
 * daily-rotated file `${LOG_DIR}/app-YYYY-MM-DD.jsonl`, capturing every
 * OpenRouter call (success + failure, full request/response), run lifecycle,
 * model swaps, and unhandled errors — a durable forensic record beside the
 * human-readable NestJS `Logger`.
 *
 * Writes are **best-effort and non-blocking**: the public `log*` methods return
 * immediately and can never throw, so a logging failure (disk full, bad path)
 * cannot break or slow a run — it falls back to the console `Logger`. Tests can
 * `await flush()` to observe the file after a write.
 */
@Injectable()
export class LoggingService {
  private readonly fallback = new Logger('Diag');
  private readonly dir: string;
  private readonly toFile: boolean;
  private readonly minRank: number;
  private readonly secrets: readonly string[];
  /** Serializes appends and lets tests await the last write. */
  private pending: Promise<void> = Promise.resolve();

  constructor(config: ConfigService) {
    this.dir = resolve(
      process.cwd(),
      config.get<string>('LOG_DIR', 'apps/api/data/logs'),
    );
    // `@nestjs/config` validates LOG_TO_FILE to a real boolean; a raw/fake config
    // may still hand back the string "false".
    const toFile = config.get<boolean | string>('LOG_TO_FILE', true);
    this.toFile = toFile !== false && toFile !== 'false';
    const level = (config.get<string>('LOG_LEVEL', 'info') as LogLevel) ?? 'info';
    this.minRank = LEVEL_RANK[level] ?? LEVEL_RANK.info;
    this.secrets = [
      config.get<string>('OPENROUTER_API_KEY') ?? '',
      config.get<string>('JWT_SECRET') ?? '',
      config.get<string>('SEED_PASSWORD') ?? '',
    ].filter((s) => s.length > 0);
  }

  /** One OpenRouter chat attempt — success or failure (SPEC §5.4/§5.7). */
  logOpenRouterCall(fields: {
    model: string;
    attempt: number;
    status: number | null;
    latencyMs: number;
    request?: unknown;
    response?: unknown;
    usage?: unknown;
    error?: unknown;
    runId?: string | null;
    personaKey?: string | null;
    message?: string;
  }): void {
    const error = fields.error ? toLogError(fields.error) : undefined;
    this.record({
      event: 'openrouter.call',
      level: error || (fields.status != null && fields.status >= 400) ? 'error' : 'info',
      model: fields.model,
      attempt: fields.attempt,
      status: fields.status,
      latencyMs: fields.latencyMs,
      request: fields.request,
      response: fields.response,
      usage: fields.usage,
      error,
      runId: fields.runId ?? null,
      personaKey: fields.personaKey ?? null,
      message: fields.message,
    });
  }

  /** A run transition: running / completed / failed / aborted_over_budget. */
  logRunLifecycle(fields: {
    runId: string;
    status: string;
    mode?: string;
    message?: string;
    error?: unknown;
  }): void {
    const error = fields.error ? toLogError(fields.error) : undefined;
    this.record({
      event: 'run.lifecycle',
      level: error ? 'error' : 'info',
      runId: fields.runId,
      status: undefined,
      error,
      message: fields.message ?? `run ${fields.status}${fields.mode ? ` (${fields.mode})` : ''}`,
    });
  }

  /** A model was found unusable and swapped for another free model (§5.2/§5.4). */
  logSwap(fields: {
    runId: string;
    personaKey: string;
    fromModel: string;
    toModel: string;
    reason: string;
  }): void {
    this.record({
      event: 'run.swap',
      level: 'warn',
      runId: fields.runId,
      personaKey: fields.personaKey,
      model: fields.fromModel,
      message: `swapped "${fields.fromModel}" → "${fields.toModel}" (${fields.reason})`,
    });
  }

  /** An error that reached the global exception filter (SPEC §12). */
  logUnhandledError(error: unknown, message?: string): void {
    this.record({
      event: 'error.unhandled',
      level: 'error',
      error: toLogError(error),
      message,
    });
  }

  /** Await the last scheduled write (tests only). */
  flush(): Promise<void> {
    return this.pending;
  }

  /** Build, gate, redact, and schedule a single entry. Never throws (§5.7). */
  private record(partial: Omit<LogEntry, 'ts'>): void {
    try {
      if (LEVEL_RANK[partial.level] < this.minRank) return;
      const entry = redact(
        { ts: new Date().toISOString(), ...partial },
        this.secrets,
      ) as LogEntry;
      const line = `${JSON.stringify(entry)}\n`;

      if (!this.toFile) {
        this.fallback.log(line.trimEnd());
        return;
      }
      // Fire-and-forget: chain onto `pending` so appends serialize and a rejection
      // is caught in `append` (never surfaced to the caller's run).
      this.pending = this.pending.then(() => this.append(entry.ts, line));
    } catch (err) {
      // Building/serializing the entry failed — best-effort, swallow it (§5.7).
      this.fallback.warn(`diagnostic log entry dropped: ${(err as Error).message}`);
    }
  }

  private async append(ts: string, line: string): Promise<void> {
    try {
      await mkdir(this.dir, { recursive: true });
      // Daily rotation: bucket by the entry's UTC date (SPEC §5.7).
      const day = ts.slice(0, 10);
      await appendFile(resolve(this.dir, `app-${day}.jsonl`), line, 'utf8');
    } catch (err) {
      // Best-effort: a logging failure must never break a run — fall back to console.
      this.fallback.warn(
        `diagnostic log write failed (${(err as Error).message}); entry: ${line.trimEnd()}`,
      );
    }
  }
}

/** Normalize any thrown value into a JSON-safe {@link LogError}. */
function toLogError(err: unknown): LogError {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return { name: 'Error', message: String(err) };
}
