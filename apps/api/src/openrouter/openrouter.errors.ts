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
