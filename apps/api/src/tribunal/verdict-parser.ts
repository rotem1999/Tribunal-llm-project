import { Decision } from '@tribunal/shared-types';

/** Parsed judge output (SPEC §5.6). */
export interface ParsedVerdict {
  decision: Decision;
  confidence: number;
  reasoning: string;
}

export interface NeedsReask {
  needsReask: true;
}

const DECISION_RE = /DECISION:\s*(justified|not_justified)/gi;
const CONFIDENCE_RE = /CONFIDENCE:\s*(-?\d{1,4})/i;

/**
 * Parse the strict block from a judge's answer (SPEC §5.6). Case-insensitive;
 * tolerates reasoning above the block and trailing whitespace. Confidence is
 * clamped to 0–100. Duplicate DECISION lines → take the last. Returns
 * `{ needsReask: true }` when either field is missing.
 */
export function parseVerdict(raw: string): ParsedVerdict | NeedsReask {
  const decisions = [...raw.matchAll(DECISION_RE)];
  const conf = raw.match(CONFIDENCE_RE);
  if (decisions.length === 0 || !conf) return { needsReask: true };
  const decision = decisions[decisions.length - 1][1].toLowerCase() as Decision;
  const confidence = Math.max(0, Math.min(100, Number.parseInt(conf[1], 10)));
  return { decision, confidence, reasoning: raw.trim() };
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
