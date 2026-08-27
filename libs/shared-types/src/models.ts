/** OpenRouter model contract (SPEC §5.2, §10). */

/**
 * One entry of `GET /models/free` — the live, cached list of zero-price
 * OpenRouter models the UI offers for Mode A (SPEC §5.2).
 */
export interface FreeModel {
  id: string;
  contextLength: number;
}
