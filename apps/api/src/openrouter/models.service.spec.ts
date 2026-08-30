import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { ConfigService } from '@nestjs/config';
import { ModelsService } from './models.service';
import {
  DataPolicyError,
  ModelUnavailableError,
  OpenRouterError,
} from './openrouter.errors';

/**
 * Free-model roster + per-mode assignment (SPEC §5.2). No real network: the
 * global `fetch` and ConfigService are mocked. Determinism is a hard rule.
 */

interface RawModel {
  id: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
}

/** Minimal ConfigService stub: known keys, defaults honored, API key required. */
function makeConfig(overrides: Record<string, string> = {}): ConfigService {
  const values: Record<string, string> = {
    OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1',
    OPENROUTER_API_KEY: 'test-key',
    ...overrides,
  };
  return {
    get: (key: string, def?: string) => values[key] ?? def,
    getOrThrow: (key: string) => {
      const v = values[key];
      if (v === undefined) throw new Error(`Missing config ${key}`);
      return v;
    },
  } as unknown as ConfigService;
}

/** Build a fetch mock that resolves `/models` with the given raw list. */
function mockModelsFetch(data: RawModel[], status = 200) {
  const fetchMock = jest.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ data }),
    text: async () => JSON.stringify({ data }),
  }));
  (globalThis as { fetch: unknown }).fetch = fetchMock as unknown;
  return fetchMock;
}

const freeA: RawModel = {
  id: 'free/a',
  context_length: 8000,
  pricing: { prompt: '0', completion: '0' },
};
const freeBig: RawModel = {
  id: 'free/big',
  context_length: 128000,
  pricing: { prompt: '0', completion: '0' },
};
const freeMid: RawModel = {
  id: 'free/mid',
  context_length: 32000,
  pricing: { prompt: '0', completion: '0' },
};
const freePromptPaidCompletion: RawModel = {
  id: 'sneaky/paid-completion',
  context_length: 200000,
  pricing: { prompt: '0', completion: '0.000002' },
};
const fullyPaid: RawModel = {
  id: 'paid/model',
  context_length: 1000000,
  pricing: { prompt: '0.0001', completion: '0.0002' },
};

const realFetch = (globalThis as { fetch?: unknown }).fetch;

afterEach(() => {
  (globalThis as { fetch?: unknown }).fetch = realFetch;
});

describe('ModelsService.getFreeModels (filtering + sorting)', () => {
  let fetchMock: ReturnType<typeof jest.fn>;
  let service: ModelsService;

  beforeEach(() => {
    fetchMock = mockModelsFetch([
      freeMid,
      fullyPaid,
      freeBig,
      freePromptPaidCompletion,
      freeA,
    ]);
    service = new ModelsService(makeConfig());
  });

  it('keeps only models where BOTH prompt and completion price are exactly "0"', async () => {
    const models = await service.getFreeModels();
    const ids = models.map((m) => m.id);
    expect(ids).toContain('free/a');
    expect(ids).toContain('free/big');
    expect(ids).toContain('free/mid');
    // Excludes fully paid and free-prompt/paid-completion.
    expect(ids).not.toContain('paid/model');
    expect(ids).not.toContain('sneaky/paid-completion');
  });

  it('sorts free models by context length descending', async () => {
    const models = await service.getFreeModels();
    expect(models.map((m) => m.id)).toEqual(['free/big', 'free/mid', 'free/a']);
    expect(models.map((m) => m.contextLength)).toEqual([128000, 32000, 8000]);
  });

  it('defaults a missing context_length to 0', async () => {
    mockModelsFetch([
      { id: 'no/ctx', pricing: { prompt: '0', completion: '0' } },
    ]);
    const svc = new ModelsService(makeConfig());
    const models = await svc.getFreeModels();
    expect(models[0].contextLength).toBe(0);
  });

  it('caches within the TTL (a second call does not re-fetch)', async () => {
    await service.getFreeModels();
    await service.getFreeModels();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('force=true bypasses the cache and re-fetches', async () => {
    await service.getFreeModels();
    await service.getFreeModels(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('sends the API key as a bearer token to the {baseUrl}/models endpoint', async () => {
    await service.getFreeModels();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://openrouter.ai/api/v1/models');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer test-key',
    );
  });

  it('strips a trailing slash from a configured base URL', async () => {
    mockModelsFetch([freeA]);
    const svc = new ModelsService(
      makeConfig({ OPENROUTER_BASE_URL: 'https://proxy.example/api/v1/' }),
    );
    const fetchMock2 = (
      globalThis as unknown as { fetch: ReturnType<typeof jest.fn> }
    ).fetch;
    await svc.getFreeModels();
    expect(fetchMock2.mock.calls[0][0]).toBe('https://proxy.example/api/v1/models');
  });
});

describe('ModelsService.getFreeModels (error mapping)', () => {
  it('throws the actionable DataPolicyError when no free models exist', async () => {
    mockModelsFetch([fullyPaid, freePromptPaidCompletion]);
    const service = new ModelsService(makeConfig());
    await expect(service.getFreeModels()).rejects.toBeInstanceOf(DataPolicyError);
    await expect(service.getFreeModels()).rejects.toThrow(
      /free-endpoint privacy toggles/i,
    );
  });

  it('maps a 404 from /models to DataPolicyError (SPEC §5.3)', async () => {
    mockModelsFetch([], 404);
    const service = new ModelsService(makeConfig());
    await expect(service.getFreeModels()).rejects.toBeInstanceOf(DataPolicyError);
  });

  it('maps other non-2xx responses to OpenRouterError with the status', async () => {
    mockModelsFetch([], 500);
    const service = new ModelsService(makeConfig());
    await expect(service.getFreeModels()).rejects.toBeInstanceOf(OpenRouterError);
    await expect(service.getFreeModels()).rejects.toThrow(/500/);
  });

  it('treats a response with no data array as an empty list -> DataPolicyError', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => '{}',
    }));
    (globalThis as { fetch: unknown }).fetch = fetchMock as unknown;
    const service = new ModelsService(makeConfig());
    await expect(service.getFreeModels()).rejects.toBeInstanceOf(DataPolicyError);
  });
});

describe('ModelsService.resolveModeAModel (Mode A)', () => {
  beforeEach(() => {
    mockModelsFetch([freeMid, freeBig, freeA]); // sorted -> big, mid, a
  });

  it('honors MODE_A_MODEL when it is still free', async () => {
    const service = new ModelsService(makeConfig());
    expect(await service.resolveModeAModel('free/mid')).toBe('free/mid');
  });

  it('falls back to the top (highest-context) free model when preferred is not free', async () => {
    const service = new ModelsService(makeConfig());
    expect(await service.resolveModeAModel('paid/model')).toBe('free/big');
  });

  it('falls back to the top free model when no preference is given', async () => {
    const service = new ModelsService(makeConfig());
    expect(await service.resolveModeAModel()).toBe('free/big');
  });
});

describe('ModelsService.assignModeBModels (Mode B)', () => {
  const personaKeys = ['a1', 'a2', 'a3', 'a4', 'j1', 'j2', 'j3'];

  it('assigns 7 DISTINCT models when >= 7 free models exist', async () => {
    const seven: RawModel[] = Array.from({ length: 8 }, (_, i) => ({
      id: `free/${i}`,
      context_length: (i + 1) * 1000,
      pricing: { prompt: '0', completion: '0' },
    }));
    mockModelsFetch(seven);
    const service = new ModelsService(makeConfig());
    const assignment = await service.assignModeBModels(personaKeys);
    expect(Object.keys(assignment)).toHaveLength(7);
    expect(new Set(Object.values(assignment)).size).toBe(7);
  });

  it('round-robins deterministically when fewer than 7 free models exist', async () => {
    mockModelsFetch([freeBig, freeMid, freeA]); // sorted -> big, mid, a
    const service = new ModelsService(makeConfig());
    const assignment = await service.assignModeBModels(personaKeys);
    // i % 3 over [big, mid, a]
    expect(assignment).toEqual({
      a1: 'free/big',
      a2: 'free/mid',
      a3: 'free/a',
      a4: 'free/big',
      j1: 'free/mid',
      j2: 'free/a',
      j3: 'free/big',
    });
  });

  it('is deterministic — same input yields the same assignment', async () => {
    mockModelsFetch([freeBig, freeMid, freeA]);
    const service = new ModelsService(makeConfig());
    const first = await service.assignModeBModels(personaKeys);
    const second = await service.assignModeBModels(personaKeys);
    expect(first).toEqual(second);
  });

  it('assigns the single available model to everyone when only one is free', async () => {
    mockModelsFetch([freeA]);
    const service = new ModelsService(makeConfig());
    const assignment = await service.assignModeBModels(personaKeys);
    expect(new Set(Object.values(assignment))).toEqual(new Set(['free/a']));
  });
});

describe('ModelsService.markUnavailable — restricted-model fallback', () => {
  // Roster sorted by context desc -> [free/big, free/mid, free/a].
  beforeEach(() => {
    mockModelsFetch([freeMid, freeBig, freeA]);
  });

  it('excludes a marked model from getFreeModels() and keeps the rest in order', async () => {
    const service = new ModelsService(makeConfig());
    service.markUnavailable('free/big'); // the top model
    const ids = (await service.getFreeModels()).map((m) => m.id);
    expect(ids).not.toContain('free/big');
    expect(ids).toEqual(['free/mid', 'free/a']);
  });

  it('resolveModeAModel() returns the next model when the top one is unavailable', async () => {
    const service = new ModelsService(makeConfig());
    // Without marking, the top model would be chosen.
    expect(await service.resolveModeAModel()).toBe('free/big');
    service.markUnavailable('free/big');
    expect(await service.resolveModeAModel()).toBe('free/mid');
  });

  it('does NOT honor a preferred model that has been marked unavailable', async () => {
    const service = new ModelsService(makeConfig());
    // Sanity: preferred is honored while still usable.
    expect(await service.resolveModeAModel('free/mid')).toBe('free/mid');
    service.markUnavailable('free/mid');
    // Now the excluded preferred must fall back to the top usable model.
    expect(await service.resolveModeAModel('free/mid')).toBe('free/big');
  });

  it('marking is cumulative — each marked model is skipped', async () => {
    const service = new ModelsService(makeConfig());
    service.markUnavailable('free/big');
    service.markUnavailable('free/mid');
    expect(await service.resolveModeAModel()).toBe('free/a');
    expect((await service.getFreeModels()).map((m) => m.id)).toEqual(['free/a']);
  });

  it('marking an id that is not in the roster is a no-op', async () => {
    const service = new ModelsService(makeConfig());
    service.markUnavailable('does/not-exist');
    expect((await service.getFreeModels()).map((m) => m.id)).toEqual([
      'free/big',
      'free/mid',
      'free/a',
    ]);
  });
});

describe('ModelsService.pickReplacement', () => {
  beforeEach(() => {
    mockModelsFetch([freeMid, freeBig, freeA]); // sorted -> big, mid, a
  });

  it('returns the top free model not in the exclude set', async () => {
    const service = new ModelsService(makeConfig());
    expect(await service.pickReplacement(new Set())).toBe('free/big');
    expect(await service.pickReplacement(new Set(['free/big']))).toBe('free/mid');
    expect(await service.pickReplacement(new Set(['free/big', 'free/mid']))).toBe(
      'free/a',
    );
  });

  it('returns undefined when every free model is excluded', async () => {
    const service = new ModelsService(makeConfig());
    const all = new Set(['free/big', 'free/mid', 'free/a']);
    expect(await service.pickReplacement(all)).toBeUndefined();
  });

  it('also skips models already marked unavailable (they are gone from the roster)', async () => {
    const service = new ModelsService(makeConfig());
    service.markUnavailable('free/big');
    // free/big is excluded by markUnavailable; exclude set removes free/mid too.
    expect(await service.pickReplacement(new Set(['free/mid']))).toBe('free/a');
  });
});

describe('ModelsService.getFreeModels — all free models unavailable', () => {
  it('throws ModelUnavailableError (NOT DataPolicyError) when a non-empty roster is fully marked', async () => {
    mockModelsFetch([freeMid, freeBig, freeA]);
    const service = new ModelsService(makeConfig());
    service.markUnavailable('free/big');
    service.markUnavailable('free/mid');
    service.markUnavailable('free/a');
    const err = await service.getFreeModels().catch((e) => e);
    expect(err).toBeInstanceOf(ModelUnavailableError);
    expect(err).not.toBeInstanceOf(DataPolicyError);
    expect(err.message).toMatch(/every free model was rejected/i);
  });

  it('an empty / paid-only roster still throws DataPolicyError (not ModelUnavailableError)', async () => {
    mockModelsFetch([fullyPaid, freePromptPaidCompletion]);
    const service = new ModelsService(makeConfig());
    const err = await service.getFreeModels().catch((e) => e);
    expect(err).toBeInstanceOf(DataPolicyError);
    expect(err).not.toBeInstanceOf(ModelUnavailableError);
  });

  it('resolveModeAModel() surfaces ModelUnavailableError when all free models are marked', async () => {
    mockModelsFetch([freeBig, freeA]);
    const service = new ModelsService(makeConfig());
    service.markUnavailable('free/big');
    service.markUnavailable('free/a');
    await expect(service.resolveModeAModel('free/big')).rejects.toBeInstanceOf(
      ModelUnavailableError,
    );
  });
});
