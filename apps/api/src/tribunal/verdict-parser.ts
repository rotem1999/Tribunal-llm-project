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
 * `Confidence level is 90%`, `CONFIDENCE 40`. Global so we can take the LAST
 * match: a reasoning model that echoes the format or rehearses a number before
 * its final answer must not win over the real one.
 */
const CONFIDENCE_RE =
  /CONFIDENCE(?:\s*LEVEL)?\s*[:-]?\s*(?:is\s+)?(-?\d{1,4})\s*%?/gi;

/**
 * Reasoning/thinking blocks some models wrap around (or emit before) their
 * answer: `<think>…</think>`, `<thinking>…</thinking>`, `<reasoning>…</reasoning>`.
 * Stripped before parsing so a DECISION/CONFIDENCE/OPINION rehearsed *inside* the
 * model's private reasoning cannot be mistaken for its final verdict. Only
 * balanced tag blocks are removed — free-form "Here's a thinking process…" prose
 * is prevented at the source by disabling reasoning on the call (§5.4/§5.6).
 */
const THINK_BLOCK_RE =
  /<(think|thinking|reasoning)\b[^>]*>[\s\S]*?<\/\1>/gi;

/** Capture the OPINION text up to the next machine line (or end). */
const OPINION_RE = /OPINION:\s*([\s\S]*?)(?:\n\s*(?:CONFIDENCE|DECISION)\b|$)/i;

/** Remove balanced reasoning/thinking tag blocks (see {@link THINK_BLOCK_RE}). */
function stripReasoning(raw: string): string {
  return raw.replace(THINK_BLOCK_RE, '').trim();
}

/**
 * Parse the strict block from a judge's answer (SPEC §5.6). Case-insensitive;
 * confidence clamped to 0–100; duplicate DECISION/CONFIDENCE lines → take the
 * last. `reasoning` is the short OPINION (falling back to the block-stripped
 * text). Returns `{ needsReask: true }` when DECISION or CONFIDENCE is missing.
 */
export function parseVerdict(rawInput: string): ParsedVerdict | NeedsReask {
  const raw = stripReasoning(rawInput);
  const decisions = [...raw.matchAll(DECISION_RE)];
  const confidences = [...raw.matchAll(CONFIDENCE_RE)];
  if (decisions.length === 0 || confidences.length === 0) {
    return { needsReask: true };
  }
  const decision = decisions[decisions.length - 1][1].toLowerCase() as Decision;
  const lastConf = confidences[confidences.length - 1][1];
  const confidence = Math.max(0, Math.min(100, Number.parseInt(lastConf, 10)));
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
