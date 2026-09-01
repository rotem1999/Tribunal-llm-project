import { describe, expect, it } from 'vitest';
import { ErrorCode } from '@tribunal/shared-types';
import { copyForCode, isUncategorized, codeOf, copyForError } from './errors';
import { ApiError } from './client';

/**
 * The frontend copy presenter (SPEC §12.1): plain-language wording keyed by the
 * backend's stable `ErrorCode`, with an INTERNAL fallback and the uncategorized
 * rule that decides whether a quotable reference is shown.
 */
describe('copyForCode', () => {
  it('returns the specific copy for each known code', () => {
    expect(copyForCode(ErrorCode.NO_FREE_MODELS)).toContain(
      'No free AI models are available',
    );
    expect(copyForCode(ErrorCode.OUT_OF_CREDITS)).toContain('out of credits');
    expect(copyForCode(ErrorCode.RATE_LIMITED)).toContain('busy right now');
    expect(copyForCode(ErrorCode.MODEL_UNAVAILABLE)).toContain(
      "couldn't reach a working AI model",
    );
    expect(copyForCode(ErrorCode.PROVIDER_ERROR)).toContain(
      'had a problem completing this run',
    );
    expect(copyForCode(ErrorCode.VERDICT_UNREADABLE)).toContain(
      "couldn't be read clearly",
    );
    expect(copyForCode(ErrorCode.UNAUTHORIZED)).toContain('session has ended');
    expect(copyForCode(ErrorCode.INVALID_INPUT)).toContain(
      "weren't entered correctly",
    );
    expect(copyForCode(ErrorCode.NETWORK)).toContain(
      "Couldn't reach the Tribunal service",
    );
    expect(copyForCode(ErrorCode.INTERNAL)).toBe(
      'Something went wrong. Please try again.',
    );
  });

  it('falls back to the INTERNAL copy for undefined / null / unknown codes', () => {
    const internal = 'Something went wrong. Please try again.';
    expect(copyForCode(undefined)).toBe(internal);
    expect(copyForCode(null)).toBe(internal);
    expect(copyForCode('NOT_A_REAL_CODE' as ErrorCode)).toBe(internal);
  });
});

describe('isUncategorized', () => {
  it('is true for INTERNAL, NETWORK, and undefined / null', () => {
    expect(isUncategorized(ErrorCode.INTERNAL)).toBe(true);
    expect(isUncategorized(ErrorCode.NETWORK)).toBe(true);
    expect(isUncategorized(undefined)).toBe(true);
    expect(isUncategorized(null)).toBe(true);
  });

  it('is false for the specific, actionable codes', () => {
    for (const code of [
      ErrorCode.NO_FREE_MODELS,
      ErrorCode.OUT_OF_CREDITS,
      ErrorCode.RATE_LIMITED,
      ErrorCode.MODEL_UNAVAILABLE,
      ErrorCode.PROVIDER_ERROR,
      ErrorCode.VERDICT_UNREADABLE,
      ErrorCode.UNAUTHORIZED,
      ErrorCode.INVALID_INPUT,
    ]) {
      expect(isUncategorized(code)).toBe(false);
    }
  });
});

describe('codeOf', () => {
  it('returns the code carried on an ApiError', () => {
    expect(codeOf(new ApiError('x', 500, ErrorCode.RATE_LIMITED))).toBe(
      ErrorCode.RATE_LIMITED,
    );
  });

  it('falls back to INTERNAL for any non-ApiError value', () => {
    expect(codeOf(new Error('x'))).toBe(ErrorCode.INTERNAL);
    expect(codeOf('nope')).toBe(ErrorCode.INTERNAL);
    expect(codeOf(undefined)).toBe(ErrorCode.INTERNAL);
  });
});

describe('copyForError', () => {
  it('returns the copy for the code behind a caught value', () => {
    expect(copyForError(new ApiError('raw', 402, ErrorCode.OUT_OF_CREDITS))).toContain(
      'out of credits',
    );
    // Unknown values fall through to the INTERNAL copy.
    expect(copyForError(new Error('raw boom'))).toBe(
      'Something went wrong. Please try again.',
    );
  });
});
