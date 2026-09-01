/**
 * Shared enums — the single source of truth for the front/back contract
 * (SPEC §3, §10). Framework-free: no NestJS / class-validator / Swagger imports.
 * String enums so the same values serialize over the wire and can drive
 * `@ApiProperty({ enum })` + `@IsEnum` on the api DTOs that implement these.
 */

/** Run mode (SPEC §1.1, §4.3). A = one model for all 7 personas; B = one per persona. */
export enum RunMode {
  A_single = 'A_single',
  B_per_persona = 'B_per_persona',
}

/** A judge's decision (SPEC §5 / D5). `justified` favors the accused. */
export enum Decision {
  justified = 'justified',
  not_justified = 'not_justified',
}

/** Lifecycle of a run (SPEC §4.3). */
export enum RunStatus {
  pending = 'pending',
  running = 'running',
  completed = 'completed',
  failed = 'failed',
  aborted_over_budget = 'aborted_over_budget',
}

/** Which side an advocate argues (SPEC §4.4). */
export enum Side {
  support = 'support',
  against = 'against',
}

/** A persona's role in the economy breakdown (SPEC §6). */
export enum PersonaRole {
  advocate = 'advocate',
  judge = 'judge',
}

/**
 * Stable, machine-readable failure category (SPEC §12.1). The backend classifies
 * every error into exactly one of these; the frontend maps the code to plain,
 * user-safe copy. The raw cause is never sent to the browser — it lives only in
 * the §5.7 diagnostic log. `NETWORK` is assigned client-side when a request never
 * gets a response; the rest come from the API `{ statusCode, code, message }` body.
 */
export enum ErrorCode {
  /** Expired/missing JWT (401). */
  UNAUTHORIZED = 'UNAUTHORIZED',
  /** Bad request body / validation (400). */
  INVALID_INPUT = 'INVALID_INPUT',
  /** No free models for the account — the §5.3 data-policy 404. */
  NO_FREE_MODELS = 'NO_FREE_MODELS',
  /** OpenRouter account out of credits (402). */
  OUT_OF_CREDITS = 'OUT_OF_CREDITS',
  /** Rate limited beyond the retry budget (429). */
  RATE_LIMITED = 'RATE_LIMITED',
  /** No free model could be reached for the run after swaps (422). */
  MODEL_UNAVAILABLE = 'MODEL_UNAVAILABLE',
  /** Other upstream/provider failure (502). */
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  /** A completed run whose verdict parsing fell back (§5.6). Not a failure. */
  VERDICT_UNREADABLE = 'VERDICT_UNREADABLE',
  /** Uncategorized server error (500). */
  INTERNAL = 'INTERNAL',
  /** Client-side only: the API was unreachable (no response). */
  NETWORK = 'NETWORK',
}
