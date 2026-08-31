/** Typed OpenRouter failures the run pipeline handles specifically (SPEC §5.3, §5.4, §12). */

/**
 * OpenRouter 404 "No endpoints available matching your data policy" — the
 * account must enable the two free-endpoint privacy toggles (SPEC §5.3). Carries
 * an actionable, user-facing message; never treated as a generic failure.
 */
export class DataPolicyError extends Error {
  constructor(
    message = 'No free models are available for your OpenRouter account. Enable the two free-endpoint privacy toggles in OpenRouter Settings → Privacy, or configure a paid model.',
  ) {
    super(message);
    this.name = 'DataPolicyError';
  }
}

/** OpenRouter 402 — account out of credits. Aborts the run (SPEC §5.4). */
export class OutOfCreditsError extends Error {
  constructor(message = 'OpenRouter account out of credits.') {
    super(message);
    this.name = 'OutOfCreditsError';
  }
}

/** Rate limited (429) beyond the retry budget (SPEC §5.4). */
export class RateLimitError extends Error {
  constructor(message = 'OpenRouter rate limit exceeded after retries.') {
    super(message);
    this.name = 'RateLimitError';
  }
}

/** Any other non-2xx response from OpenRouter. */
export class OpenRouterError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'OpenRouterError';
  }
}

/**
 * A single call exceeded `CALL_TIMEOUT_MS` and was aborted. Distinct so the run
 * pipeline can treat a hung model like an unavailable one and swap to another
 * free model (SPEC §5.4) instead of failing the whole run — several free
 * endpoints stream a body for minutes or never complete. Still an
 * `OpenRouterError` so generic handlers keep working.
 */
export class ModelTimeoutError extends OpenRouterError {
  constructor(
    readonly model: string,
    timeoutMs: number,
  ) {
    super(`OpenRouter call timed out after ${timeoutMs}ms`);
    this.name = 'ModelTimeoutError';
  }
}

/**
 * OpenRouter 403 for a specific model — e.g. a nominally "free" model that is
 * gated to approved agentic-harness apps ("only available on agentic
 * harnesses"), or otherwise not callable by this account. Not a generic
 * failure: the run pipeline marks the model unavailable and retries with
 * another free model (SPEC §5.2, §5.4). Only surfaces to the user (with this
 * actionable message) when no free model works.
 */
export class ModelUnavailableError extends OpenRouterError {
  constructor(
    readonly model: string,
    message = `The model "${model}" is not available for direct API use for this account — some free models are restricted to approved apps. Pick a different free model, or set MODE_A_MODEL to one that works.`,
  ) {
    super(message, 403);
    this.name = 'ModelUnavailableError';
  }
}
