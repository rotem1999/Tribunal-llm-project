/** Run contract (SPEC §4.3–4.5, §10). The output is 3 independent verdicts +
 * economy — never a combined verdict. */

import type { RunMode, RunStatus, Side, Decision, ErrorCode } from './enums.js';
import type { RunEconomy, VerdictTally } from './economy.js';

/** `POST /runs` body — no charge-sheet text (the server loads it, SPEC §10.1). */
export interface CreateRunRequest {
  mode: RunMode;
  /** Mode A only: pin the single model (free or paid); omit to auto-pick the top free one. */
  modelSingle?: string;
  /**
   * Mode B only: an explicit `{ personaKey → modelId }` map (SPEC §5.2). The UI
   * sends all 7; when omitted the server auto-assigns free models (API fallback).
   */
  modelByPersona?: Record<string, string>;
  /** Optional: which stored charge sheet to use; defaults to the active one. */
  chargeSheetId?: string;
}

/** `POST /runs` response. */
export interface CreateRunResponse {
  runId: string;
}

/** One advocate speech (SPEC §4.4). */
export interface Speech {
  id: string;
  runId: string;
  personaKey: string;
  /** Display name resolved from personalities.json (SPEC §5.6/§11). */
  personaName: string;
  side: Side;
  model: string;
  content: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  reasoningTokens?: number | null;
  costUsd: number;
  latencyMs: number;
  /** ISO-8601 timestamp. */
  createdAt: string;
}

/** One judge verdict (SPEC §4.5). `reasoning` is that judge's protocol. */
export interface Verdict {
  id: string;
  runId: string;
  personaKey: string;
  /** Display name resolved from personalities.json (SPEC §5.6/§11). */
  personaName: string;
  model: string;
  decision: Decision;
  /** 0-100. */
  confidence: number;
  reasoning: string;
  /**
   * The opinion could not be read — the model's reply was cut off, a re-ask
   * still failed, or it was empty (SPEC §5.6). `decision`/`confidence` still
   * stand; the UI shows a "recess" placeholder instead of `reasoning` (§11).
   */
  truncated: boolean;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  reasoningTokens?: number | null;
  costUsd: number;
  latencyMs: number;
  /** ISO-8601 timestamp. */
  createdAt: string;
}

/** Row shape for `GET /runs` (list of run summaries, SPEC §10). */
export interface RunSummary {
  id: string;
  /** ISO-8601 timestamp. */
  createdAt: string;
  mode: RunMode;
  status: RunStatus;
  /** Non-binding; null until completed. */
  verdictTally: VerdictTally | null;
  totalCostUsd: number;
  /** Stable failure/flag category (SPEC §12.1); null when none. */
  errorCode?: ErrorCode | null;
}

/**
 * Full run (`GET /runs/:id`, SPEC §10): the charge snapshot, 4 speeches, 3
 * verdicts (each with its protocol), economy, and the optional non-binding
 * tally. There is no combined/authoritative verdict field.
 */
export interface RunDetail {
  id: string;
  mode: RunMode;
  status: RunStatus;
  /** Mode A: the single model id used. */
  modelSingle?: string | null;
  /** Immutable exact charge-sheet text used for this run (SPEC §4.3). */
  chargeSheetSnapshot: string;
  chargeSheetTitle?: string;
  speeches: Speech[];
  verdicts: Verdict[];
  economy: RunEconomy;
  /** Non-binding; null until completed. */
  verdictTally: VerdictTally | null;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalCostUsd: number;
  costCeilingUsd: number;
  /** ISO-8601 timestamp. */
  createdAt: string;
  /** ISO-8601 timestamp; null until finished. */
  completedAt?: string | null;
  /** User-safe message on failure/partial runs (SPEC §12.1) — never the raw cause. */
  error?: string | null;
  /** Stable failure/flag category (SPEC §12.1); null when none. */
  errorCode?: ErrorCode | null;
}

/** Phase of a running tribunal, for the live animation (SPEC §5.5, §10.1). */
export type RunPhase = 'advocates' | 'judges' | 'done';

/**
 * Lightweight run progress (`GET /runs/:id/progress`, SPEC §10.1) polled by the
 * frontend to drive the per-persona circle animation (§11). Not the full run.
 */
export interface RunProgress {
  status: RunStatus;
  phase: RunPhase;
  /** Persona keys whose speech/verdict has been persisted so far. */
  completedPersonaKeys: string[];
  /** User-safe message on a failed/partial run (SPEC §12.1) — never the raw cause. */
  error?: string | null;
  /** Stable failure/flag category (SPEC §12.1); null when none. */
  errorCode?: ErrorCode | null;
}
