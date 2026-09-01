/**
 * User-facing error copy (SPEC §12.1). The frontend owns the wording, keyed by
 * the backend's stable `ErrorCode`; components render only this copy — never a
 * raw `run.error`, backend `message`, or model output. Keep these strings in step
 * with the api's `classify-error.ts` COPY (that one is the non-web fallback).
 */
import { ErrorCode } from '@tribunal/shared-types';
import { ApiError } from './client';

const COPY: Record<ErrorCode, string> = {
  [ErrorCode.UNAUTHORIZED]: 'Your session has ended. Please sign in again.',
  [ErrorCode.INVALID_INPUT]:
    "Some details weren't entered correctly. Please check and try again.",
  [ErrorCode.NO_FREE_MODELS]:
    'No free AI models are available. In your OpenRouter account, turn on the two free-endpoint privacy settings, then try again.',
  [ErrorCode.OUT_OF_CREDITS]:
    'The AI service is out of credits. Please try again later.',
  [ErrorCode.RATE_LIMITED]:
    'The AI service is busy right now. Please wait a moment and try again.',
  [ErrorCode.MODEL_UNAVAILABLE]:
    "We couldn't reach a working AI model for this run. Please try again.",
  [ErrorCode.PROVIDER_ERROR]:
    'The AI service had a problem completing this run. Please try again.',
  [ErrorCode.VERDICT_UNREADABLE]:
    "One judge's verdict couldn't be read clearly, so a cautious default was used.",
  [ErrorCode.INTERNAL]: 'Something went wrong. Please try again.',
  [ErrorCode.NETWORK]:
    "Couldn't reach the Tribunal service. Check that it's running and try again.",
};

/**
 * Codes without a specific cause the user can act on. These get the quotable
 * reference (run id + code) so the failure can be reported (SPEC §12.1).
 */
const UNCATEGORIZED = new Set<ErrorCode>([ErrorCode.INTERNAL, ErrorCode.NETWORK]);

/** Plain-language copy for a code; falls back to the generic line. */
export function copyForCode(code?: ErrorCode | null): string {
  return (code && COPY[code]) || COPY[ErrorCode.INTERNAL];
}

/** Whether a code should show the quotable reference (SPEC §12.1). */
export function isUncategorized(code?: ErrorCode | null): boolean {
  return !code || UNCATEGORIZED.has(code);
}

/** The stable code behind any caught value (unknown → INTERNAL). */
export function codeOf(err: unknown): ErrorCode {
  return err instanceof ApiError ? err.code : ErrorCode.INTERNAL;
}

/** Convenience: friendly copy for any caught value. */
export function copyForError(err: unknown): string {
  return copyForCode(codeOf(err));
}
