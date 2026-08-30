import { Decision } from '@tribunal/shared-types';

/** Parsed judge output (SPEC §5.6). `reasoning` holds the short OPINION line. */
export interface ParsedVerdict {
  decision: Decision;
  confidence: number;
  reasoning: string;
}

export interface NeedsReask {
  needsReask: true;
}

/** Take the LAST decision line (models sometimes restate). */
const DECISION_RE = /DECISION:\s*(justified|not_justified)/gi;

/**
 * Tolerant confidence match (SPEC §5.6) — the observed failure was the number
 * being dropped or reformatted. Accepts an optional "level", an optional
 * colon/dash, an optional "is", and a trailing `%`: e.g. `CONFIDENCE: 72`,
 * `Confidence level is 90%`, `CONFIDENCE 40`.
 */
const CONFIDENCE_RE =
  /CONFIDENCE(?:\s*LEVEL)?\s*[:\-]?\s*(?:is\s+)?(-?\d{1,4})\s*%?/i;

/** Capture the OPINION text up to the next machine line (or end). */
const OPINION_RE = /OPINION:\s*([\s\S]*?)(?:\n\s*(?:CONFIDENCE|DECISION)\b|$)/i;

/**
 * Parse the strict block from a judge's answer (SPEC §5.6). Case-insensitive;
 * confidence clamped to 0–100; duplicate DECISION lines → take the last.
 * `reasoning` is the short OPINION (falling back to the block-stripped text).
 * Returns `{ needsReask: true }` when DECISION or CONFIDENCE is missing.
 */
export function parseVerdict(raw: string): ParsedVerdict | NeedsReask {
  const decisions = [...raw.matchAll(DECISION_RE)];
  const conf = raw.match(CONFIDENCE_RE);
  if (decisions.length === 0 || !conf) return { needsReask: true };
  const decision = decisions[decisions.length - 1][1].toLowerCase() as Decision;
  const confidence = Math.max(0, Math.min(100, Number.parseInt(conf[1], 10)));
  return { decision, confidence, reasoning: extractOpinion(raw) };
}

/** The short opinion for display: the OPINION line, else the block-stripped prose. */
function extractOpinion(raw: string): string {
  const m = raw.match(OPINION_RE);
  if (m && m[1].trim()) return m[1].trim();
  const stripped = raw
    .replace(/^\s*OPINION:.*$/gim, '')
    .replace(/^\s*CONFIDENCE.*$/gim, '')
    .replace(/^\s*DECISION:.*$/gim, '')
    .trim();
  return stripped || raw.trim();
}

/** Conservative fallback after a failed re-ask: benefit of the doubt to the accused. */
export function fallbackVerdict(raw = ''): ParsedVerdict {
  return { decision: Decision.justified, confidence: 0, reasoning: raw.trim() };
}

export function isNeedsReask(
  result: ParsedVerdict | NeedsReask,
): result is NeedsReask {
  return (result as NeedsReask).needsReask === true;
}
