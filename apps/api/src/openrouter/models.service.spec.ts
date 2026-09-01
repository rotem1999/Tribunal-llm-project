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
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
  };
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

  it('excludes free models that emit audio (e.g. music generators billed per second, not per token)', async () => {
    const lyria: RawModel = {
      id: 'google/lyria-3-pro-preview',
      context_length: 1048576,
      pricing: { prompt: '0', completion: '0' },
      architecture: { output_modalities: ['text', 'audio'] },
    };
    const textModel: RawModel = {
      id: 'good/text-model',
      context_length: 32000,
      pricing: { prompt: '0', completion: '0' },
      architecture: { output_modalities: ['text'] },
    };
    mockModelsFetch([lyria, textModel]);
    const svc = new ModelsService(makeConfig());
    const ids = (await svc.getFreeModels()).map((m) => m.id);
    expect(ids).toEqual(['good/text-model']);
  });

  it('excludes free models whose id matches the built-in task-type blacklist', async () => {
    mockModelsFetch([
      {
        id: 'nvidia/nemotron-3.5-content-safety:free',
        context_length: 1000000,
        pricing: { prompt: '0', completion: '0' },
      },
      {
        id: 'cohere/embed-4:free',
        context_length: 500000,
        pricing: { prompt: '0', completion: '0' },
      },
      freeBig,
    ]);
    const svc = new ModelsService(makeConfig());
    const ids = (await svc.getFreeModels()).map((m) => m.id);
    expect(ids).toEqual(['free/big']);
  });

  it('extends the blacklist from the MODEL_BLACKLIST env var (case-insensitive substring)', async () => {
    mockModelsFetch([
      { id: 'vendor/Experimental-Alpha', context_length: 9000, pricing: { prompt: '0', completion: '0' } },
      freeA,
    ]);
    const svc = new ModelsService(makeConfig({ MODEL_BLACKLIST: 'experimental, foo' }));
    const ids = (await svc.getFreeModels()).map((m) => m.id);
    expect(ids).toEqual(['free/a']);
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

describe('ModelsService.getUsableModels (free + paid filtering + sorting)', () => {
  it('keeps BOTH free and paid text models, dropping only non-text/blacklisted ones', async () => {
    mockModelsFetch([
      freeMid,
      fullyPaid,
      freePromptPaidCompletion, // paid (non-zero completion) — still a usable text model
      freeBig,
      freeA,
    ]);
    const service = new ModelsService(makeConfig());
    const ids = (await service.getUsableModels()).map((m) => m.id);
    // Free AND paid text models are all kept.
    expect(ids).toContain('free/big');
    expect(ids).toContain('paid/model');
    expect(ids).toContain('sneaky/paid-completion');
    expect(ids).toHaveLength(5);
  });

  it('excludes non-text (audio) models and blacklisted task-type ids', async () => {
    const lyria: RawModel = {
      id: 'google/lyria-3-audio-output',
      context_length: 1048576,
      pricing: { prompt: '0', completion: '0' },
      architecture: { output_modalities: ['text', 'audio'] },
    };
    const embed: RawModel = {
      id: 'cohere/embed-4',
      context_length: 500000,
      pricing: { prompt: '0.0000001', completion: '0' },
    };
    mockModelsFetch([lyria, embed, fullyPaid, freeBig]);
    const service = new ModelsService(makeConfig());
    const ids = (await service.getUsableModels()).map((m) => m.id);
    expect(ids).not.toContain('google/lyria-3-audio-output');
    expect(ids).not.toContain('cohere/embed-4');
    expect(ids).toEqual(['free/big', 'paid/model']);
  });

  it('sets isFree correctly and parses pricing strings to numbers', async () => {
    mockModelsFetch([freeBig, freePromptPaidCompletion, fullyPaid]);
    const service = new ModelsService(makeConfig());
    const models = await service.getUsableModels();
    const byId = Object.fromEntries(models.map((m) => [m.id, m]));

    expect(byId['free/big'].isFree).toBe(true);
    expect(byId['free/big'].promptUsd).toBe(0);
    expect(byId['free/big'].completionUsd).toBe(0);

    // Any non-zero price → not free.
    expect(byId['sneaky/paid-completion'].isFree).toBe(false);
    expect(byId['sneaky/paid-completion'].promptUsd).toBe(0);
    expect(byId['sneaky/paid-completion'].completionUsd).toBe(0.000002);

    expect(byId['paid/model'].isFree).toBe(false);
    expect(byId['paid/model'].promptUsd).toBe(0.0001);
    expect(byId['paid/model'].completionUsd).toBe(0.0002);
  });

  it('sorts free-first, then price ascending, then context descending', async () => {
    mockModelsFetch([
      fullyPaid, // paid, 0.0003 total, ctx 1_000_000
      freePromptPaidCompletion, // paid, 0.000002 total, ctx 200_000
      freeMid, // free, ctx 32_000
      freeBig, // free, ctx 128_000
    ]);
    const service = new ModelsService(makeConfig());
    const ids = (await service.getUsableModels()).map((m) => m.id);
    expect(ids).toEqual([
      'free/big', // free, biggest context
      'free/mid', // free
      'sneaky/paid-completion', // cheapest paid
      'paid/model', // priciest paid
    ]);
  });

  it('the GET /models controller path returns free AND paid; getFreeModels is the free subset', async () => {
    mockModelsFetch([freeBig, fullyPaid, freeA]);
    const service = new ModelsService(makeConfig());
    const usable = (await service.getUsableModels()).map((m) => m.id);
    const free = (await service.getFreeModels()).map((m) => m.id);
    expect(usable).toEqual(['free/big', 'free/a', 'paid/model']);
    expect(free).toEqual(['free/big', 'free/a']);
  });
});

describe('ModelsService.resolveModeAModel — paid pin + config source', () => {
  it('returns a PAID pin when it is a usable candidate', async () => {
    mockModelsFetch([freeBig, freeA, fullyPaid]);
    const service = new ModelsService(makeConfig());
    expect(await service.resolveModeAModel('paid/model')).toBe('paid/model');
  });

  it('returns a FREE pin when it is a usable candidate', async () => {
    mockModelsFetch([freeBig, freeA, fullyPaid]);
    const service = new ModelsService(makeConfig());
    expect(await service.resolveModeAModel('free/a')).toBe('free/a');
  });

  it('falls back to the top free model when the pin is unusable (unknown id)', async () => {
    mockModelsFetch([freeBig, freeA, fullyPaid]);
    const service = new ModelsService(makeConfig());
    expect(await service.resolveModeAModel('does/not-exist')).toBe('free/big');
  });

  it('honors MODE_A_MODEL from config (including a paid one) when no arg is passed', async () => {
    mockModelsFetch([freeBig, freeA, fullyPaid]);
    const service = new ModelsService(makeConfig({ MODE_A_MODEL: 'paid/model' }));
    expect(await service.resolveModeAModel()).toBe('paid/model');
  });

  it('an explicit preferred arg overrides MODE_A_MODEL from config', async () => {
    mockModelsFetch([freeBig, freeA, fullyPaid]);
    const service = new ModelsService(makeConfig({ MODE_A_MODEL: 'paid/model' }));
    expect(await service.resolveModeAModel('free/a')).toBe('free/a');
  });
});

describe('ModelsService.assignModeBModels — explicit map', () => {
  const personaKeys = ['a1', 'a2', 'a3', 'a4', 'j1', 'j2', 'j3'];

  function fullMap(id: string): Record<string, string> {
    return Object.fromEntries(personaKeys.map((k) => [k, id]));
  }

  it('returns the caller map verbatim when every persona names a usable model', async () => {
    mockModelsFetch([freeBig, freeMid, freeA, fullyPaid]);
    const service = new ModelsService(makeConfig());
    const requested: Record<string, string> = {
      a1: 'free/big',
      a2: 'free/mid',
      a3: 'free/a',
      a4: 'paid/model', // paid is allowed in an explicit Mode B map
      j1: 'free/big',
      j2: 'free/mid',
      j3: 'free/a',
    };
    expect(await service.assignModeBModels(personaKeys, requested)).toEqual(
      requested,
    );
  });

  it('throws ModelUnavailableError when the map is MISSING a persona', async () => {
    mockModelsFetch([freeBig, freeMid, freeA]);
    const service = new ModelsService(makeConfig());
    const incomplete = { ...fullMap('free/big') };
    delete incomplete['j3'];
    await expect(
      service.assignModeBModels(personaKeys, incomplete),
    ).rejects.toBeInstanceOf(ModelUnavailableError);
  });

  it('throws ModelUnavailableError when the map names an unknown/unusable model', async () => {
    mockModelsFetch([freeBig, freeMid, freeA]);
    const service = new ModelsService(makeConfig());
    const bad = { ...fullMap('free/big'), j2: 'nope/not-real' };
    await expect(
      service.assignModeBModels(personaKeys, bad),
    ).rejects.toBeInstanceOf(ModelUnavailableError);
  });

  it('rejects a map naming a model that exists but was marked unavailable', async () => {
    mockModelsFetch([freeBig, freeMid, freeA]);
    const service = new ModelsService(makeConfig());
    service.markUnavailable('free/mid');
    const bad = { ...fullMap('free/big'), a2: 'free/mid' };
    await expect(
      service.assignModeBModels(personaKeys, bad),
    ).rejects.toBeInstanceOf(ModelUnavailableError);
  });

  it('auto-assigns distinct free models when NO map is provided', async () => {
    const seven: RawModel[] = Array.from({ length: 7 }, (_, i) => ({
      id: `free/${i}`,
      context_length: (i + 1) * 1000,
      pricing: { prompt: '0', completion: '0' },
    }));
    mockModelsFetch(seven);
    const service = new ModelsService(makeConfig());
    const assignment = await service.assignModeBModels(personaKeys);
    expect(new Set(Object.values(assignment)).size).toBe(7);
  });

  it('an empty map is treated as "no map" (auto-assign), not an error', async () => {
    mockModelsFetch([freeBig, freeMid, freeA]);
    const service = new ModelsService(makeConfig());
    const assignment = await service.assignModeBModels(personaKeys, {});
    expect(Object.keys(assignment)).toHaveLength(7);
    expect(assignment['a1']).toBe('free/big');
  });
});

describe('ModelsService.pickReplacement — free-first across free + paid', () => {
  beforeEach(() => {
    // Usable sort -> [free/big, free/a, paid/model].
    mockModelsFetch([freeA, fullyPaid, freeBig]);
  });

  it('returns the top usable model not excluded, preferring free over paid', async () => {
    const service = new ModelsService(makeConfig());
    expect(await service.pickReplacement(new Set())).toBe('free/big');
    expect(await service.pickReplacement(new Set(['free/big']))).toBe('free/a');
    // Both free excluded -> falls through to the paid model.
    expect(
      await service.pickReplacement(new Set(['free/big', 'free/a'])),
    ).toBe('paid/model');
  });

  it('returns undefined when every usable model is excluded', async () => {
    const service = new ModelsService(makeConfig());
    expect(
      await service.pickReplacement(
        new Set(['free/big', 'free/a', 'paid/model']),
      ),
    ).toBeUndefined();
  });
});
