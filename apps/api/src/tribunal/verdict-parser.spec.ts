import { describe, expect, it } from '@jest/globals';
import { Decision } from '@tribunal/shared-types';
import {
  fallbackVerdict,
  isNeedsReask,
  parseVerdict,
  type NeedsReask,
  type ParsedVerdict,
} from './verdict-parser';

/**
 * Judge-output parser (SPEC §5.6). Parses the strict DECISION/CONFIDENCE block
 * out of free-form reasoning. We only ever assert on parsing/structure — never
 * on the model's prose.
 */

/** Narrowing helper for the union result in assertions. */
function asParsed(r: ParsedVerdict | NeedsReask): ParsedVerdict {
  if (isNeedsReask(r)) throw new Error('expected a parsed verdict, got needsReask');
  return r;
}

describe('parseVerdict', () => {
  it('parses a clean block with reasoning above it', () => {
    const raw = [
      'The accused acted within the rules of engagement.',
      'On balance the conduct was defensible.',
      'DECISION: justified',
      'CONFIDENCE: 72',
    ].join('\n');
    const parsed = asParsed(parseVerdict(raw));
    expect(parsed.decision).toBe(Decision.justified);
    expect(parsed.confidence).toBe(72);
    // reasoning keeps the whole (trimmed) text — including the block.
    expect(parsed.reasoning).toBe(raw);
  });

  it('parses not_justified', () => {
    const parsed = asParsed(
      parseVerdict('reasoning\nDECISION: not_justified\nCONFIDENCE: 10'),
    );
    expect(parsed.decision).toBe(Decision.not_justified);
    expect(parsed.confidence).toBe(10);
  });

  it('is case-insensitive on the labels and the decision value', () => {
    const parsed = asParsed(
      parseVerdict('decision: JUSTIFIED\nconfidence: 55'),
    );
    expect(parsed.decision).toBe(Decision.justified);
    expect(parsed.confidence).toBe(55);
  });

  it('tolerates extra whitespace after the colon', () => {
    const parsed = asParsed(
      parseVerdict('DECISION:    not_justified\nCONFIDENCE:   3'),
    );
    expect(parsed.decision).toBe(Decision.not_justified);
    expect(parsed.confidence).toBe(3);
  });

  it('takes the LAST decision when duplicates exist', () => {
    const raw = [
      'DECISION: justified',
      'wait, on reflection:',
      'DECISION: not_justified',
      'CONFIDENCE: 40',
    ].join('\n');
    const parsed = asParsed(parseVerdict(raw));
    expect(parsed.decision).toBe(Decision.not_justified);
  });

  it('clamps confidence above 100 down to 100', () => {
    expect(asParsed(parseVerdict('DECISION: justified\nCONFIDENCE: 250')).confidence).toBe(100);
  });

  it('clamps negative confidence up to 0', () => {
    expect(asParsed(parseVerdict('DECISION: justified\nCONFIDENCE: -5')).confidence).toBe(0);
  });

  it('accepts boundary values 0 and 100 unchanged', () => {
    expect(asParsed(parseVerdict('DECISION: justified\nCONFIDENCE: 0')).confidence).toBe(0);
    expect(asParsed(parseVerdict('DECISION: justified\nCONFIDENCE: 100')).confidence).toBe(100);
  });

  it('needsReask when DECISION is missing', () => {
    const r = parseVerdict('I think it was fine.\nCONFIDENCE: 80');
    expect(isNeedsReask(r)).toBe(true);
  });

  it('needsReask when CONFIDENCE is missing', () => {
    const r = parseVerdict('DECISION: justified\n(no confidence given)');
    expect(isNeedsReask(r)).toBe(true);
  });

  it('needsReask on entirely unrelated text', () => {
    expect(isNeedsReask(parseVerdict('the quick brown fox'))).toBe(true);
    expect(isNeedsReask(parseVerdict(''))).toBe(true);
  });

  it('does not accept an out-of-vocabulary decision word', () => {
    // "maybe" is not one of the two allowed tokens -> DECISION not found.
    expect(isNeedsReask(parseVerdict('DECISION: maybe\nCONFIDENCE: 50'))).toBe(true);
  });

  it('trims trailing whitespace/newlines from reasoning', () => {
    const parsed = asParsed(parseVerdict('  DECISION: justified\nCONFIDENCE: 5  \n\n'));
    expect(parsed.reasoning).toBe('DECISION: justified\nCONFIDENCE: 5');
  });
});

describe('fallbackVerdict', () => {
  it('returns justified with confidence 0 (benefit of the doubt)', () => {
    const fv = fallbackVerdict();
    expect(fv.decision).toBe(Decision.justified);
    expect(fv.confidence).toBe(0);
    expect(fv.reasoning).toBe('');
  });

  it('carries the trimmed raw text through as reasoning', () => {
    const fv = fallbackVerdict('  garbled model output  ');
    expect(fv.decision).toBe(Decision.justified);
    expect(fv.confidence).toBe(0);
    expect(fv.reasoning).toBe('garbled model output');
  });
});

describe('isNeedsReask', () => {
  it('discriminates the two result shapes', () => {
    expect(isNeedsReask({ needsReask: true })).toBe(true);
    expect(
      isNeedsReask({ decision: Decision.justified, confidence: 1, reasoning: 'x' }),
    ).toBe(false);
  });
});
