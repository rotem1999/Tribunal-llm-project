import { describe, expect, it } from '@jest/globals';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@tribunal/shared-types';
import { classifyError, messageFor } from './classify-error';
import {
  DataPolicyError,
  ModelTimeoutError,
  ModelUnavailableError,
  OpenRouterError,
  OutOfCreditsError,
  RateLimitError,
} from '../openrouter/openrouter.errors';

/**
 * The one source of truth for error classification (SPEC §12.1): every thrown
 * value is reduced to a stable `{ status, code, message }`, where `message` is
 * the user-safe copy and NEVER the raw cause.
 */
describe('classifyError — OpenRouter domain errors', () => {
  it('maps DataPolicyError to 404 NO_FREE_MODELS', () => {
    const { status, code } = classifyError(new DataPolicyError());
    expect(status).toBe(HttpStatus.NOT_FOUND);
    expect(status).toBe(404);
    expect(code).toBe(ErrorCode.NO_FREE_MODELS);
  });

  it('maps OutOfCreditsError to 402 OUT_OF_CREDITS', () => {
    const { status, code } = classifyError(new OutOfCreditsError());
    expect(status).toBe(HttpStatus.PAYMENT_REQUIRED);
    expect(status).toBe(402);
    expect(code).toBe(ErrorCode.OUT_OF_CREDITS);
  });

  it('maps RateLimitError to 429 RATE_LIMITED', () => {
    const { status, code } = classifyError(new RateLimitError());
    expect(status).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(status).toBe(429);
    expect(code).toBe(ErrorCode.RATE_LIMITED);
  });

  it('maps ModelUnavailableError to 422 MODEL_UNAVAILABLE', () => {
    const { status, code } = classifyError(new ModelUnavailableError('gated/model'));
    expect(status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(status).toBe(422);
    expect(code).toBe(ErrorCode.MODEL_UNAVAILABLE);
  });

  it('maps ModelTimeoutError to 422 MODEL_UNAVAILABLE', () => {
    const { status, code } = classifyError(new ModelTimeoutError('slow/model', 30000));
    expect(status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(status).toBe(422);
    expect(code).toBe(ErrorCode.MODEL_UNAVAILABLE);
  });

  it('maps a plain OpenRouterError to 502 PROVIDER_ERROR', () => {
    const { status, code } = classifyError(new OpenRouterError('upstream boom', 503));
    expect(status).toBe(HttpStatus.BAD_GATEWAY);
    expect(status).toBe(502);
    expect(code).toBe(ErrorCode.PROVIDER_ERROR);
  });

  it('matches the specific subclasses before the generic OpenRouterError branch (422, not 502)', () => {
    // ModelUnavailableError / ModelTimeoutError both extend OpenRouterError; the
    // more specific branch must win so they map to MODEL_UNAVAILABLE (422).
    for (const err of [
      new ModelUnavailableError('x/y'),
      new ModelTimeoutError('x/y', 1000),
    ]) {
      const { status, code } = classifyError(err);
      expect(status).not.toBe(HttpStatus.BAD_GATEWAY);
      expect(status).toBe(422);
      expect(code).toBe(ErrorCode.MODEL_UNAVAILABLE);
      expect(code).not.toBe(ErrorCode.PROVIDER_ERROR);
    }
  });
});

describe('classifyError — HttpException', () => {
  it('maps a 401 HttpException to UNAUTHORIZED (status 401)', () => {
    const { status, code } = classifyError(
      new HttpException('nope', HttpStatus.UNAUTHORIZED),
    );
    expect(status).toBe(401);
    expect(code).toBe(ErrorCode.UNAUTHORIZED);
  });

  it('maps a 400 HttpException to INVALID_INPUT (status 400)', () => {
    const { status, code } = classifyError(
      new HttpException('bad body', HttpStatus.BAD_REQUEST),
    );
    expect(status).toBe(400);
    expect(code).toBe(ErrorCode.INVALID_INPUT);
  });

  it('keeps the status of any other HttpException but stays generic (INTERNAL)', () => {
    const { status, code } = classifyError(
      new HttpException('missing', HttpStatus.NOT_FOUND),
    );
    expect(status).toBe(404);
    expect(code).toBe(ErrorCode.INTERNAL);
  });
});

describe('classifyError — unknown / fallback', () => {
  it('maps a plain Error to 500 INTERNAL', () => {
    const { status, code } = classifyError(new Error('kaboom'));
    expect(status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(status).toBe(500);
    expect(code).toBe(ErrorCode.INTERNAL);
  });

  it('maps a non-Error thrown value to 500 INTERNAL', () => {
    const { status, code } = classifyError('just a string');
    expect(status).toBe(500);
    expect(code).toBe(ErrorCode.INTERNAL);
  });
});

describe('classifyError — the message is user-safe, never the raw cause', () => {
  it('does not leak the OpenRouterError raw message', () => {
    const { message } = classifyError(new OpenRouterError('upstream boom', 503));
    expect(message).not.toContain('upstream boom');
    expect(message).toContain('had a problem completing this run');
  });

  it('does not leak a plain Error message', () => {
    const { message } = classifyError(new Error('kaboom'));
    expect(message).not.toContain('kaboom');
    expect(message).toBe('Something went wrong. Please try again.');
  });

  it('returns the code-keyed user-safe copy for each code', () => {
    expect(classifyError(new DataPolicyError()).message).toContain(
      'No free AI models are available',
    );
    expect(classifyError(new OutOfCreditsError()).message).toContain(
      'out of credits',
    );
    expect(classifyError(new RateLimitError()).message).toContain('busy right now');
    expect(classifyError(new ModelUnavailableError('m')).message).toContain(
      "couldn't reach a working AI model",
    );
  });
});

describe('messageFor', () => {
  it('returns the same user-safe copy classifyError uses', () => {
    expect(messageFor(ErrorCode.INTERNAL)).toBe(
      classifyError(new Error('x')).message,
    );
    expect(messageFor(ErrorCode.NETWORK)).toContain(
      "Couldn't reach the Tribunal service",
    );
  });
});
