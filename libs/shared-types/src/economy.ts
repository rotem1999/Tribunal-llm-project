/** Token-economy contract (SPEC §6). Shapes for the per-run JSON file, the
 * cumulative ledger line, and the UI economy panel. */

import type { RunMode, PersonaRole, Side, Decision } from './enums.js';

/** Non-binding count of the 3 verdicts, for display only (SPEC §4.3 / D5). */
export type VerdictTally = Record<Decision, number>;

/** One persona's usage/cost row (all 7 personas appear). */
export interface PersonaEconomy {
  personaKey: string;
  role: PersonaRole;
  /** Present for advocates; null/absent for judges. */
  side?: Side | null;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  reasoningTokens: number;
  costUsd: number;
}

/** Per-model rollup (groups persona calls by model id). */
export interface ModelEconomy {
  model: string;
  calls: number;
  totalTokens: number;
  costUsd: number;
}

/** Grand totals across all 7 calls. */
export interface EconomyTotals {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
}

/**
 * Per-run economy JSON — file (a) `data/runs/<runId>.json` and the payload of
 * `GET /runs/:id/economy` (SPEC §6a).
 */
export interface RunEconomy {
  runId: string;
  /** ISO-8601 timestamp. */
  createdAt: string;
  mode: RunMode;
  chargeSheetChars: number;
  verdictTally: VerdictTally | null;
  perPersona: PersonaEconomy[];
  perModel: ModelEconomy[];
  totals: EconomyTotals;
  costCeilingUsd: number;
  status: string;
}

/**
 * One line of the cumulative ledger — file (b) `data/ledger.jsonl` and each
 * entry of `GET /economy/ledger` (SPEC §6b).
 */
export interface LedgerEntry {
  runId: string;
  /** ISO-8601 timestamp. */
  createdAt: string;
  mode: RunMode;
  totalTokens: number;
  costUsd: number;
  verdictTally: VerdictTally | null;
}
