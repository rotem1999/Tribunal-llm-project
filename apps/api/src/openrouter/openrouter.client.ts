import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DataPolicyError,
  ModelTimeoutError,
  ModelUnavailableError,
  OpenRouterError,
  OutOfCreditsError,
  RateLimitError,
} from './openrouter.errors';

/**
 * A provider-side failure (the model's upstream returned an error), as opposed
 * to an OpenRouter-level validation failure of our own request. OpenRouter wraps
 * these as `{"error":{"message":"Provider returned error",...,"metadata":
 * {"provider_name":...}}}`. Matches the 400 "invalid argument" case and the 5xx
 * upstream-error case alike so the pipeline swaps models instead of failing.
 */
const PROVIDER_ERROR_RE =
  /provider returned error|invalid[_ ]argument|provider_name|upstream error/i;

/**
 * A model that will not honor `reasoning: { enabled: false }` — it hard-rejects
 * the request ("Reasoning is mandatory for this endpoint and cannot be
 * disabled"). Exactly the kind that floods the response with chain-of-thought,
 * so it is skipped like any other unusable model rather than failing the run.
 */
const REASONING_REQUIRED_RE =
  /reasoning is (?:mandatory|required)|cannot be disabled/i;
import type {
  CallModelParams,
  CallModelResult,
  OpenRouterChatResponse,
} from './openrouter.types';

const MAX_ATTEMPTS = 4;

/**
 * The single OpenRouter chat wrapper used by every persona call (SPEC §5.4).
 * Reads real usage/cost straight from the response (never estimated), retries
 * 429 with exponential backoff + jitter, and maps 402 / the §5.3 data-policy 404
 * to typed errors. Per-call timeout via AbortController.
 */
@Injectable()
export class OpenRouterClient {

  constructor(private readonly config: ConfigService) {}

  /** Whether to send `reasoning: { enabled: false }` (default true; §5.6). */
  private reasoningDisabled(): boolean {
    // `@nestjs/config` returns the validated value (a real boolean); tests and
    // raw env may hand back the string "false".
    const v = this.config.get<boolean | string>('DISABLE_MODEL_REASONING', true);
    return v !== false && v !== 'false';
  }

  async callModel(params: CallModelParams): Promise<CallModelResult> {
    const baseUrl = this.config
      .get<string>('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1')
      .replace(/\/$/, '');
    const apiKey = this.config.getOrThrow<string>('OPENROUTER_API_KEY');
    const timeoutMs = Number(this.config.get<string>('CALL_TIMEOUT_MS', '90000'));

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Title': this.config.get<string>('OPENROUTER_APP_TITLE', 'Tribunal'),
    };
    const referer = this.config.get<string>('OPENROUTER_APP_URL');
    if (referer) headers['HTTP-Referer'] = referer;

    const payload: Record<string, unknown> = {
      model: params.model,
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userPrompt },
      ],
      temperature: params.temperature,
      max_tokens: params.maxTokens,
      // Ask OpenRouter to include usage accounting (usage.cost) in the response.
      usage: { include: true },
    };
    // Disable model "reasoning" (default). Several free models otherwise emit
    // their whole chain-of-thought as the message content and burn the entire
    // token budget before ever producing the verdict block (§5.6) — turning a
    // clean 3-line answer into multi-KB of gibberish. Off → a direct answer. A
    // model that *requires* reasoning rejects this with a 400 and is swapped
    // (see below). Set DISABLE_MODEL_REASONING=false to opt back in.
    if (this.reasoningDisabled()) {
      payload.reasoning = { enabled: false };
    }
    const body = JSON.stringify(payload);

    let lastRateLimit: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const started = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let status: number;
      let json: OpenRouterChatResponse | undefined;
      let errorText = '';
      try {
        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body,
          signal: controller.signal,
        });
        status = res.status;
        // The timeout must cover the BODY read too, not just the headers: free
        // endpoints return headers in milliseconds and then stream a
        // whitespace-padded body while the upstream generates — sometimes for
        // minutes, sometimes never finishing. Reading the body inside the armed
        // timer (cleared only in `finally`) is what actually enforces §5.4.
        if (res.ok) {
          json = (await res.json()) as OpenRouterChatResponse;
        } else {
          errorText = await res.text().catch(() => '');
        }
      } catch (err) {
        if (controller.signal.aborted) {
          throw new ModelTimeoutError(params.model, timeoutMs);
        }
        throw err;
      } finally {
        clearTimeout(timer);
      }

      if (json) {
        return this.normalize(json, Date.now() - started);
      }

      // 429 — rate limited: back off and retry.
      if (status === 429) {
        lastRateLimit = errorText;
        if (attempt < MAX_ATTEMPTS) {
          await this.backoff(attempt);
          continue;
        }
        throw new RateLimitError();
      }
      // 402 — out of credits: abort, no retry.
      if (status === 402) throw new OutOfCreditsError();
      // 400 — this model refuses to run with reasoning disabled. Skip it and
      // swap to a model that can return the plain verdict block (§5.6).
      if (status === 400 && REASONING_REQUIRED_RE.test(errorText)) {
        throw new ModelUnavailableError(
          params.model,
          `The model "${params.model}" requires reasoning and won't return a plain verdict — skipping it and trying another free model.`,
        );
      }
      // 403 — this model is restricted/unavailable for the account (e.g. a free
      // model gated to approved agentic-harness apps). Typed so the pipeline can
      // skip it and try another free model instead of failing the run.
      if (status === 403) throw new ModelUnavailableError(params.model);
      // Provider-side failure (not our own bad request): a 400 "invalid
      // argument" or an upstream 5xx that OpenRouter wraps with provider
      // metadata (e.g. a Google AI Studio free model returning
      // {"error":{"message":"Provider returned error",...,"metadata":
      // {"provider_name":...}}}, or an "Upstream error from <provider>: Service
      // temporarily overloaded"). Treat as model-unavailable so the pipeline
      // swaps to another free model rather than failing the run (SPEC §5.4). An
      // OpenRouter-level error with no provider fingerprint still falls through
      // to a hard error so a real bug in our own request is not masked.
      if (
        (status === 400 || (status >= 500 && status <= 599)) &&
        PROVIDER_ERROR_RE.test(errorText)
      ) {
        throw new ModelUnavailableError(
          params.model,
          `The model "${params.model}" was rejected by its provider (${status}) — skipping it and trying another free model.`,
        );
      }
      // 404 data-policy: the specific free-endpoint privacy error (SPEC §5.3).
      if (status === 404 && /data policy|data_policy|endpoints/i.test(errorText)) {
        throw new DataPolicyError();
      }
      throw new OpenRouterError(
        `OpenRouter request failed (${status}): ${errorText.slice(0, 300)}`,
        status,
      );
    }
    // Unreachable, but keeps the type checker happy.
    throw new RateLimitError(String(lastRateLimit ?? ''));
  }

  private normalize(
    json: OpenRouterChatResponse,
    latencyMs: number,
  ): CallModelResult {
    const u = json.usage ?? {};
    return {
      content: json.choices?.[0]?.message?.content ?? '',
      usage: {
        promptTokens: u.prompt_tokens ?? 0,
        completionTokens: u.completion_tokens ?? 0,
        totalTokens: u.total_tokens ?? 0,
        reasoningTokens: u.completion_tokens_details?.reasoning_tokens ?? null,
        costUsd: u.cost ?? 0,
      },
      latencyMs,
    };
  }

  /** Exponential backoff with jitter: ~1s, 2s, 4s. Overridable in tests. */
  protected backoff(attempt: number): Promise<void> {
    const base = 2 ** (attempt - 1) * 1000;
    const jitter = Math.floor(Math.random() * 250);
    return new Promise((resolve) => setTimeout(resolve, base + jitter));
  }
}
