import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@tribunal/shared-types';
import {
  DataPolicyError,
  ModelTimeoutError,
  ModelUnavailableError,
  OpenRouterError,
  OutOfCreditsError,
  RateLimitError,
} from '../openrouter/openrouter.errors';

/** A failure reduced to a stable code + HTTP status + user-safe message (§12.1). */
export interface ClassifiedError {
  status: number;
  code: ErrorCode;
  /** Plain, non-technical, safe to show a user. Never the raw cause. */
  message: string;
}

/**
 * User-safe copy per code (SPEC §12.1). The API returns this as a sensible
 * default for any consumer (curl, Swagger); the web app keeps its own copy table
 * keyed by the same codes and is authoritative for the UI — keep the two in step.
 */
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

/** The user-safe message for a code (SPEC §12.1). */
export function messageFor(code: ErrorCode): string {
  return COPY[code];
}

/**
 * Reduce any thrown value to a `{ status, code, message }` (SPEC §12.1). The one
 * source of truth for error classification, used by both the global exception
 * filter and the run pipeline. The raw cause is deliberately discarded here — it
 * belongs only in the §5.7 diagnostic log, never in a user-facing response.
 *
 * Subclass ordering matters: `ModelUnavailableError` / `ModelTimeoutError` extend
 * `OpenRouterError`, so they are matched before the generic OpenRouter branch.
 */
export function classifyError(err: unknown): ClassifiedError {
  if (err instanceof DataPolicyError) {
    return build(HttpStatus.NOT_FOUND, ErrorCode.NO_FREE_MODELS);
  }
  if (err instanceof OutOfCreditsError) {
    return build(HttpStatus.PAYMENT_REQUIRED, ErrorCode.OUT_OF_CREDITS);
  }
  if (err instanceof RateLimitError) {
    return build(HttpStatus.TOO_MANY_REQUESTS, ErrorCode.RATE_LIMITED);
  }
  if (err instanceof ModelUnavailableError || err instanceof ModelTimeoutError) {
    return build(HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.MODEL_UNAVAILABLE);
  }
  if (err instanceof OpenRouterError) {
    return build(HttpStatus.BAD_GATEWAY, ErrorCode.PROVIDER_ERROR);
  }
  if (err instanceof HttpException) {
    const status = err.getStatus();
    if (status === HttpStatus.UNAUTHORIZED) {
      return build(status, ErrorCode.UNAUTHORIZED);
    }
    if (status === HttpStatus.BAD_REQUEST) {
      return build(status, ErrorCode.INVALID_INPUT);
    }
    // Any other HttpException keeps its status but stays user-safe & generic.
    return build(status, ErrorCode.INTERNAL);
  }
  return build(HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.INTERNAL);
}

function build(status: number, code: ErrorCode): ClassifiedError {
  return { status, code, message: COPY[code] };
}
