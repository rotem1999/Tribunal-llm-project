import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DataPolicyError,
  ModelUnavailableError,
  OpenRouterError,
  OutOfCreditsError,
  RateLimitError,
} from './openrouter.errors';
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

    const body = JSON.stringify({
      model: params.model,
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userPrompt },
      ],
      temperature: params.temperature,
      max_tokens: params.maxTokens,
      // Ask OpenRouter to include usage accounting (usage.cost) in the response.
      usage: { include: true },
    });

    let lastRateLimit: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const started = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let res: Response;
      try {
        res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body,
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timer);
        if (controller.signal.aborted) {
          throw new OpenRouterError(
            `OpenRouter call timed out after ${timeoutMs}ms`,
          );
        }
        throw err;
      } finally {
        clearTimeout(timer);
      }

      if (res.ok) {
        const json = (await res.json()) as OpenRouterChatResponse;
        return this.normalize(json, Date.now() - started);
      }

      const errorText = await res.text().catch(() => '');
      // 429 — rate limited: back off and retry.
      if (res.status === 429) {
        lastRateLimit = errorText;
        if (attempt < MAX_ATTEMPTS) {
          await this.backoff(attempt);
          continue;
        }
        throw new RateLimitError();
      }
      // 402 — out of credits: abort, no retry.
      if (res.status === 402) throw new OutOfCreditsError();
      // 403 — this model is restricted/unavailable for the account (e.g. a free
      // model gated to approved agentic-harness apps). Typed so the pipeline can
      // skip it and try another free model instead of failing the run.
      if (res.status === 403) throw new ModelUnavailableError(params.model);
      // 400 — a provider-side "invalid argument" (e.g. a Google AI Studio free
      // model rejecting the request: {"error":{"message":"Provider returned
      // error",...,"metadata":{"provider_name":"Google AI Studio",...}}}). Treat
      // it as model-unavailable so the pipeline swaps to another free model
      // rather than failing the run (SPEC §5.4). An OpenRouter-level 400 (our own
      // bad request, no provider metadata) still falls through to a hard error.
      if (
        res.status === 400 &&
        /provider returned error|invalid[_ ]argument|provider_name/i.test(errorText)
      ) {
        throw new ModelUnavailableError(
          params.model,
          `The model "${params.model}" was rejected by its provider (400 invalid argument) — skipping it and trying another free model.`,
        );
      }
      // 404 data-policy: the specific free-endpoint privacy error (SPEC §5.3).
      if (res.status === 404 && /data policy|data_policy|endpoints/i.test(errorText)) {
        throw new DataPolicyError();
      }
      throw new OpenRouterError(
        `OpenRouter request failed (${res.status}): ${errorText.slice(0, 300)}`,
        res.status,
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
