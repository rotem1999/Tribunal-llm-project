import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ConfigService } from '@nestjs/config';
import { LoggingService } from './logging.service';

/**
 * File-writer tests for the diagnostic log (SPEC §5.7 / §14.2). Deterministic and
 * DB-free: each test writes to a fresh temp dir, `await svc.flush()` to observe
 * the serialized append, then reads the JSONL lines back off disk. Redaction,
 * `LOG_LEVEL` gating, `LOG_TO_FILE`, and best-effort write-failure swallowing are
 * all asserted here.
 */

/**
 * A fake `ConfigService` exposing `get(key, def)` over the supplied values,
 * mirroring the repo's `makeConfig` convention. Uses `??` so a stored `false`
 * (e.g. `LOG_TO_FILE`) survives instead of falling back to the default.
 */
function makeConfig(overrides: Record<string, unknown> = {}): ConfigService {
  const values: Record<string, unknown> = { ...overrides };
  return {
    get: (key: string, def?: unknown) => values[key] ?? def,
  } as unknown as ConfigService;
}

/** Today's UTC date, matching the service's daily-rotation bucket. */
const today = new Date().toISOString().slice(0, 10);

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'tribunal-log-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

/** Read every `.jsonl` file in `d` and JSON.parse each non-empty line. */
async function readEntries(d: string): Promise<Record<string, unknown>[]> {
  const files = (await readdir(d)).filter((f) => f.endsWith('.jsonl'));
  const entries: Record<string, unknown>[] = [];
  for (const f of files) {
    const text = await readFile(join(d, f), 'utf8');
    for (const line of text.split('\n')) {
      if (line.trim().length > 0) entries.push(JSON.parse(line));
    }
  }
  return entries;
}

/** Concatenate the raw text of every `.jsonl` file in `d`. */
async function readRaw(d: string): Promise<string> {
  const files = (await readdir(d)).filter((f) => f.endsWith('.jsonl'));
  const parts: string[] = [];
  for (const f of files) parts.push(await readFile(join(d, f), 'utf8'));
  return parts.join('');
}

describe('LoggingService — JSONL entry shape', () => {
  it('writes one JSONL entry per call carrying the §5.7 shape', async () => {
    const svc = new LoggingService(makeConfig({ LOG_DIR: dir }));
    const usage = {
      promptTokens: 100,
      completionTokens: 40,
      totalTokens: 140,
      reasoningTokens: 12,
      costUsd: 0,
    };
    svc.logOpenRouterCall({
      model: 'free/model',
      attempt: 1,
      status: 200,
      latencyMs: 1234,
      request: { messages: [{ role: 'user', content: 'hi' }] },
      response: { choices: [{ message: { content: 'ok' } }] },
      usage,
      runId: 'run-1',
      personaKey: 'support_1',
    });
    await svc.flush();

    const entries = await readEntries(dir);
    expect(entries).toHaveLength(1);
    const e = entries[0];
    expect(typeof e.ts).toBe('string');
    expect(e.level).toBe('info');
    expect(e.event).toBe('openrouter.call');
    expect(e.model).toBe('free/model');
    expect(e.attempt).toBe(1);
    expect(e.status).toBe(200);
    expect(e.latencyMs).toBe(1234);
    expect(e.runId).toBe('run-1');
    expect(e.personaKey).toBe('support_1');
    expect(e.usage).toEqual(usage);
  });

  it('names the file app-YYYY-MM-DD.jsonl using today\'s UTC date', async () => {
    const svc = new LoggingService(makeConfig({ LOG_DIR: dir }));
    svc.logOpenRouterCall({
      model: 'free/model',
      attempt: 1,
      status: 200,
      latencyMs: 5,
    });
    await svc.flush();

    const files = await readdir(dir);
    expect(files).toContain(`app-${today}.jsonl`);
  });
});

describe('LoggingService — redaction (never writes secrets)', () => {
  it('never writes secret values or the Authorization header, and marks them [REDACTED]', async () => {
    const API_KEY = 'sk-or-APIKEY-abc123';
    const JWT_SECRET = 'jwt-SUPERSECRET-xyz789';
    const SEED_PASSWORD = 'p@ss-SEED-999';
    const svc = new LoggingService(
      makeConfig({
        LOG_DIR: dir,
        OPENROUTER_API_KEY: API_KEY,
        JWT_SECRET,
        SEED_PASSWORD,
      }),
    );

    svc.logOpenRouterCall({
      model: 'free/model',
      attempt: 1,
      status: 200,
      latencyMs: 7,
      request: {
        headers: { Authorization: `Bearer ${API_KEY}`, 'X-Title': 'Tribunal' },
        messages: [{ role: 'user', content: `login with ${SEED_PASSWORD}` }],
      },
      response: { signedWith: `token ${JWT_SECRET}` },
    });
    await svc.flush();

    const raw = await readRaw(dir);
    // No secret survives anywhere in the raw file text.
    expect(raw).not.toContain(API_KEY);
    expect(raw).not.toContain(JWT_SECRET);
    expect(raw).not.toContain(SEED_PASSWORD);
    // And the redaction sentinel is present (the Authorization key + the values).
    expect(raw).toContain('[REDACTED]');
    // A safe header is retained.
    expect(raw).toContain('X-Title');
  });
});

describe('LoggingService — LOG_LEVEL gating', () => {
  it("with LOG_LEVEL='error' drops an info lifecycle entry but keeps an unhandled error", async () => {
    const svc = new LoggingService(makeConfig({ LOG_DIR: dir, LOG_LEVEL: 'error' }));
    svc.logRunLifecycle({ runId: 'run-1', status: 'running' }); // info → dropped
    svc.logUnhandledError(new Error('boom'), 'kaboom'); // error → kept
    await svc.flush();

    const entries = await readEntries(dir);
    expect(entries).toHaveLength(1);
    expect(entries[0].event).toBe('error.unhandled');
    expect(entries[0].level).toBe('error');
  });
});

describe('LoggingService — LOG_TO_FILE=false', () => {
  it('writes nothing to disk (console only)', async () => {
    const svc = new LoggingService(makeConfig({ LOG_DIR: dir, LOG_TO_FILE: false }));
    svc.logOpenRouterCall({
      model: 'free/model',
      attempt: 1,
      status: 200,
      latencyMs: 3,
    });
    await svc.flush();

    const files = (await readdir(dir)).filter((f) => f.endsWith('.jsonl'));
    expect(files).toHaveLength(0);
  });
});

describe('LoggingService — best-effort write failure', () => {
  it('swallows a write failure so the run continues (flush resolves)', async () => {
    // Put LOG_DIR *under* an existing file so mkdir/appendFile throw (ENOTDIR).
    const blocker = join(dir, 'blocker');
    await writeFile(blocker, 'not a directory');
    const svc = new LoggingService(makeConfig({ LOG_DIR: join(blocker, 'sub') }));

    svc.logOpenRouterCall({
      model: 'free/model',
      attempt: 1,
      status: 200,
      latencyMs: 9,
    });

    // The best-effort writer must never reject.
    await expect(svc.flush()).resolves.toBeUndefined();
  });
});
