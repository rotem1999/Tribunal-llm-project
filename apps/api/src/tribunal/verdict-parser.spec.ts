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
 * Judge-output parser (SPEC §5.6). Parses the strict OPINION/CONFIDENCE/DECISION
 * block; `reasoning` is the short opinion. We assert on parsing/structure only.
 */

function asParsed(r: ParsedVerdict | NeedsReask): ParsedVerdict {
  if (isNeedsReask(r)) throw new Error('expected a parsed verdict, got needsReask');
  return r;
}

describe('parseVerdict', () => {
  it('parses a clean OPINION/CONFIDENCE/DECISION block into the short opinion', () => {
    const raw = [
      'OPINION: On balance the conduct was defensible.',
      'CONFIDENCE: 72',
      'DECISION: justified',
    ].join('\n');
    const parsed = asParsed(parseVerdict(raw));
    expect(parsed.decision).toBe(Decision.justified);
    expect(parsed.confidence).toBe(72);
    // reasoning is the OPINION line only — not the machine lines.
    expect(parsed.reasoning).toBe('On balance the conduct was defensible.');
  });

  it('falls back to block-stripped prose when OPINION is absent', () => {
    const raw = 'The accused acted within the rules.\nCONFIDENCE: 30\nDECISION: not_justified';
    const parsed = asParsed(parseVerdict(raw));
    expect(parsed.decision).toBe(Decision.not_justified);
    expect(parsed.confidence).toBe(30);
    expect(parsed.reasoning).toBe('The accused acted within the rules.');
  });

  it('parses not_justified', () => {
    const parsed = asParsed(
      parseVerdict('OPINION: r\nDECISION: not_justified\nCONFIDENCE: 10'),
    );
    expect(parsed.decision).toBe(Decision.not_justified);
    expect(parsed.confidence).toBe(10);
  });

  it('is case-insensitive on the labels and the decision value', () => {
    const parsed = asParsed(parseVerdict('decision: JUSTIFIED\nconfidence: 55'));
    expect(parsed.decision).toBe(Decision.justified);
    expect(parsed.confidence).toBe(55);
  });

  it('tolerates "confidence level is NN%" phrasing (the observed inconsistency)', () => {
    const parsed = asParsed(
      parseVerdict('OPINION: x\nMy confidence level is 90%.\nDECISION: justified'),
    );
    expect(parsed.confidence).toBe(90);
    expect(parsed.decision).toBe(Decision.justified);
  });

  it('tolerates CONFIDENCE without a colon', () => {
    expect(
      asParsed(parseVerdict('CONFIDENCE 40\nDECISION: justified')).confidence,
    ).toBe(40);
  });

  it('takes the LAST decision when duplicates exist', () => {
    const raw = [
      'DECISION: justified',
      'wait, on reflection:',
      'DECISION: not_justified',
      'CONFIDENCE: 40',
    ].join('\n');
    expect(asParsed(parseVerdict(raw)).decision).toBe(Decision.not_justified);
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
    expect(isNeedsReask(parseVerdict('OPINION: fine.\nCONFIDENCE: 80'))).toBe(true);
  });

  it('needsReask when CONFIDENCE is missing', () => {
    expect(isNeedsReask(parseVerdict('DECISION: justified\n(no confidence given)'))).toBe(true);
  });

  it('needsReask on entirely unrelated text', () => {
    expect(isNeedsReask(parseVerdict('the quick brown fox'))).toBe(true);
    expect(isNeedsReask(parseVerdict(''))).toBe(true);
  });

  it('does not accept an out-of-vocabulary decision word', () => {
    expect(isNeedsReask(parseVerdict('DECISION: maybe\nCONFIDENCE: 50'))).toBe(true);
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
