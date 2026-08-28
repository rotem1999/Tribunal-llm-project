import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { ConfigService } from '@nestjs/config';
import { OpenRouterClient } from './openrouter.client';
import {
  DataPolicyError,
  OpenRouterError,
  OutOfCreditsError,
  RateLimitError,
} from './openrouter.errors';
import type { CallModelParams } from './openrouter.types';

/**
 * The single OpenRouter chat wrapper (SPEC §5.4). No real network and no real
 * delays: `fetch` is mocked and the protected `backoff` is overridden to resolve
 * immediately. We assert on usage capture, retry policy, and typed error mapping.
 */

/** Subclass that neutralizes backoff (no real timers) and counts retries. */
class TestClient extends OpenRouterClient {
  backoffCalls: number[] = [];
  protected override backoff(attempt: number): Promise<void> {
    this.backoffCalls.push(attempt);
    return Promise.resolve();
  }
}

function makeConfig(overrides: Record<string, string> = {}): ConfigService {
  const values: Record<string, string> = {
    OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1',
    OPENROUTER_API_KEY: 'test-key',
    CALL_TIMEOUT_MS: '90000',
    OPENROUTER_APP_TITLE: 'Tribunal',
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

const PARAMS: CallModelParams = {
  model: 'free/model',
  systemPrompt: 'sys',
  userPrompt: 'user',
  temperature: 0.7,
  maxTokens: 512,
};

/** A 2xx response carrying a full usage block. */
function okResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

/** A non-2xx response with a text body. */
function errResponse(status: number, text = '') {
  return {
    ok: false,
    status,
    json: async () => ({}),
    text: async () => text,
  };
}

function setFetch(impl: (...args: unknown[]) => unknown) {
  const fetchMock = jest.fn(impl as never);
  (globalThis as { fetch: unknown }).fetch = fetchMock as unknown;
  return fetchMock;
}

const realFetch = (globalThis as { fetch?: unknown }).fetch;
afterEach(() => {
  (globalThis as { fetch?: unknown }).fetch = realFetch;
});

describe('OpenRouterClient.callModel — success + usage capture', () => {
  let client: TestClient;
  beforeEach(() => {
    client = new TestClient(makeConfig());
  });

  it('captures usage.cost and prompt/completion/reasoning tokens straight from the response', async () => {
    setFetch(async () =>
      okResponse({
        choices: [{ message: { content: 'the model text' } }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 40,
          total_tokens: 140,
          cost: 0.0123,
          completion_tokens_details: { reasoning_tokens: 12 },
        },
      }),
    );
    const result = await client.callModel(PARAMS);
    expect(result.content).toBe('the model text');
    expect(result.usage.promptTokens).toBe(100);
    expect(result.usage.completionTokens).toBe(40);
    expect(result.usage.totalTokens).toBe(140);
    expect(result.usage.reasoningTokens).toBe(12);
    expect(result.usage.costUsd).toBe(0.0123);
    expect(typeof result.latencyMs).toBe('number');
  });

  it('reports reasoningTokens as null when the model omits them', async () => {
    setFetch(async () =>
      okResponse({
        choices: [{ message: { content: 'x' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
    );
    const result = await client.callModel(PARAMS);
    expect(result.usage.reasoningTokens).toBeNull();
  });

  it('defaults cost to 0 (free models) and content to empty when absent', async () => {
    setFetch(async () => okResponse({}));
    const result = await client.callModel(PARAMS);
    expect(result.usage.costUsd).toBe(0);
    expect(result.content).toBe('');
    expect(result.usage.totalTokens).toBe(0);
  });

  it('POSTs to {baseUrl}/chat/completions with bearer auth and requests usage accounting', async () => {
    const fetchMock = setFetch(async () =>
      okResponse({ choices: [{ message: { content: 'x' } }], usage: {} }),
    );
    await client.callModel(PARAMS);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer test-key',
    );
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('free/model');
    expect(body.usage).toEqual({ include: true });
    expect(body.messages).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'user' },
    ]);
  });
});

describe('OpenRouterClient.callModel — retry + error mapping', () => {
  it('backs off and retries on 429, then succeeds', async () => {
    let n = 0;
    setFetch(async () => {
      n += 1;
      if (n < 3) return errResponse(429, 'rate limited');
      return okResponse({
        choices: [{ message: { content: 'ok' } }],
        usage: { total_tokens: 3 },
      });
    });
    const client = new TestClient(makeConfig());
    const result = await client.callModel(PARAMS);
    expect(result.content).toBe('ok');
    expect(n).toBe(3);
    // Backed off after the two 429s (attempts 1 and 2).
    expect(client.backoffCalls).toEqual([1, 2]);
  });

  it('throws RateLimitError after exhausting the retry budget (4 attempts)', async () => {
    const fetchMock = setFetch(async () => errResponse(429, 'still limited'));
    const client = new TestClient(makeConfig());
    await expect(client.callModel(PARAMS)).rejects.toBeInstanceOf(RateLimitError);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    // Backed off on attempts 1..3 but not after the final failed attempt.
    expect(client.backoffCalls).toEqual([1, 2, 3]);
  });

  it('maps 402 to OutOfCreditsError WITHOUT retrying', async () => {
    const fetchMock = setFetch(async () => errResponse(402, 'no credits'));
    const client = new TestClient(makeConfig());
    await expect(client.callModel(PARAMS)).rejects.toBeInstanceOf(
      OutOfCreditsError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(client.backoffCalls).toEqual([]);
  });

  it('maps the §5.3 data-policy 404 body to DataPolicyError', async () => {
    setFetch(async () =>
      errResponse(
        404,
        'No endpoints found matching your data policy (Free model publication).',
      ),
    );
    const client = new TestClient(makeConfig());
    await expect(client.callModel(PARAMS)).rejects.toBeInstanceOf(DataPolicyError);
  });

  it('maps a generic 404 (no data-policy wording) to a plain OpenRouterError', async () => {
    setFetch(async () => errResponse(404, 'not found'));
    const client = new TestClient(makeConfig());
    const err = await client.callModel(PARAMS).catch((e) => e);
    expect(err).toBeInstanceOf(OpenRouterError);
    expect(err).not.toBeInstanceOf(DataPolicyError);
    expect((err as OpenRouterError).status).toBe(404);
  });

  it('maps other non-2xx statuses to OpenRouterError carrying the status', async () => {
    setFetch(async () => errResponse(503, 'upstream down'));
    const client = new TestClient(makeConfig());
    const err = await client.callModel(PARAMS).catch((e) => e);
    expect(err).toBeInstanceOf(OpenRouterError);
    expect((err as OpenRouterError).status).toBe(503);
  });

  it('surfaces a timeout/abort as an OpenRouterError', async () => {
    // Tiny timeout; fetch rejects only once the abort signal fires.
    setFetch(
      (...args: unknown[]) =>
        new Promise((_resolve, reject) => {
          const init = args[1] as { signal?: AbortSignal };
          const signal = init?.signal;
          signal?.addEventListener('abort', () =>
            reject(new Error('The operation was aborted')),
          );
        }),
    );
    const client = new TestClient(makeConfig({ CALL_TIMEOUT_MS: '5' }));
    await expect(client.callModel(PARAMS)).rejects.toBeInstanceOf(OpenRouterError);
    await expect(
      client.callModel(PARAMS),
    ).rejects.toThrow(/timed out/i);
  });

  it('re-throws a non-abort network error as-is', async () => {
    setFetch(async () => {
      throw new Error('ECONNRESET');
    });
    const client = new TestClient(makeConfig());
    await expect(client.callModel(PARAMS)).rejects.toThrow('ECONNRESET');
  });
});
