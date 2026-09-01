/** OpenRouter model contract (SPEC §5.2, §10). */

/**
 * One entry of `GET /models/free` — the live, cached list of zero-price
 * OpenRouter models (SPEC §5.2). Retained; `ModelInfo` is the richer superset.
 */
export interface FreeModel {
  id: string;
  contextLength: number;
}

/**
 * One entry of `GET /models` — a usable text model the pickers offer, free or
 * paid (SPEC §5.2/§11). Prices are **per-token USD** (0 for free models);
 * `isFree` is true when both prices are 0.
 */
export interface ModelInfo {
  id: string;
  contextLength: number;
  promptUsd: number;
  completionUsd: number;
  isFree: boolean;
}
