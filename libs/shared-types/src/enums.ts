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
