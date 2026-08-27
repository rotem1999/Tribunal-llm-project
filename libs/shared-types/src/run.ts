/** Run contract (SPEC §4.3–4.5, §10). The output is 3 independent verdicts +
 * economy — never a combined verdict. */

import type { RunMode, RunStatus, Side, Decision } from './enums.js';
import type { RunEconomy, VerdictTally } from './economy.js';

/** `POST /runs` body — no charge-sheet text (the server loads it, SPEC §10.1). */
export interface CreateRunRequest {
  mode: RunMode;
  /** Mode A only: pin the single model; omit to auto-pick a free one. */
  modelSingle?: string;
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
  model: string;
  decision: Decision;
  /** 0-100. */
  confidence: number;
  reasoning: string;
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
  /** Populated on failure / partial runs. */
  error?: string | null;
}
