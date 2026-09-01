import { describe, expect, it, jest } from '@jest/globals';
import {
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ErrorCode } from '@tribunal/shared-types';
import { AllExceptionsFilter } from './all-exceptions.filter';
import {
  DataPolicyError,
  ModelUnavailableError,
  OpenRouterError,
  OutOfCreditsError,
  RateLimitError,
} from '../openrouter/openrouter.errors';

/**
 * Maps every failure to the one user-safe error body (SPEC §12.1):
 * `{ statusCode, code, message }`, where `message` is plain and never the raw
 * cause. No real HTTP: a fake Express Response records status()/json(), and a
 * minimal ArgumentsHost hands it to the filter.
 */

/** A fake Express Response capturing the last status()/json() call. */
function makeResponse() {
  const res = {
    statusCode: undefined as number | undefined,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  jest.spyOn(res, 'status');
  jest.spyOn(res, 'json');
  return res;
}

/** Minimal ArgumentsHost that only supports switchToHttp().getResponse(). */
function makeHost(res: unknown): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => ({}),
      getNext: () => undefined,
    }),
  } as unknown as ArgumentsHost;
}

function run(exception: unknown) {
  const filter = new AllExceptionsFilter();
  const res = makeResponse();
  filter.catch(exception, makeHost(res));
  return res;
}

/** The body shape is now `{ statusCode, code, message }`. */
function body(res: ReturnType<typeof makeResponse>) {
  return res.body as { statusCode: number; code: ErrorCode; message: string };
}

describe('AllExceptionsFilter — ModelUnavailableError', () => {
  it('maps ModelUnavailableError to 422 + code MODEL_UNAVAILABLE', () => {
    const res = run(new ModelUnavailableError('gated/model'));
    expect(res.statusCode).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(res.statusCode).toBe(422);
    expect(body(res).statusCode).toBe(422);
    expect(body(res).code).toBe(ErrorCode.MODEL_UNAVAILABLE);
    expect(body(res).message).toContain("couldn't reach a working AI model");
  });

  it('does NOT leak the raw ModelUnavailableError message', () => {
    const err = new ModelUnavailableError(
      'free/top',
      'Every free model was rejected as restricted/unavailable for this account.',
    );
    const res = run(err);
    expect(body(res).message).not.toContain('Every free model was rejected');
    expect(body(res).message).not.toContain(err.message);
  });

  it('does NOT fall through to the OpenRouterError 502 branch (subclass ordering)', () => {
    // ModelUnavailableError extends OpenRouterError; the filter must match the
    // more specific branch first and return 422, not 502.
    const res = run(new ModelUnavailableError('x/y'));
    expect(res.statusCode).not.toBe(HttpStatus.BAD_GATEWAY);
    expect(res.statusCode).toBe(422);
    expect(body(res).code).toBe(ErrorCode.MODEL_UNAVAILABLE);
  });
});

describe('AllExceptionsFilter — other domain errors', () => {
  it('maps DataPolicyError to 404 + NO_FREE_MODELS with user-safe copy', () => {
    const err = new DataPolicyError();
    const res = run(err);
    expect(res.statusCode).toBe(HttpStatus.NOT_FOUND);
    expect(body(res).code).toBe(ErrorCode.NO_FREE_MODELS);
    expect(body(res).message).toContain('No free AI models are available');
    expect(body(res).message).not.toBe(err.message);
  });

  it('maps OutOfCreditsError to 402 + OUT_OF_CREDITS', () => {
    const res = run(new OutOfCreditsError());
    expect(res.statusCode).toBe(HttpStatus.PAYMENT_REQUIRED);
    expect(body(res).code).toBe(ErrorCode.OUT_OF_CREDITS);
    expect(body(res).message).toContain('out of credits');
  });

  it('maps RateLimitError to 429 + RATE_LIMITED', () => {
    const res = run(new RateLimitError());
    expect(res.statusCode).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(body(res).code).toBe(ErrorCode.RATE_LIMITED);
    expect(body(res).message).toContain('busy right now');
  });

  it('maps a plain OpenRouterError to 502 + PROVIDER_ERROR and hides the raw cause', () => {
    const res = run(new OpenRouterError('upstream boom', 503));
    expect(res.statusCode).toBe(HttpStatus.BAD_GATEWAY);
    expect(body(res).code).toBe(ErrorCode.PROVIDER_ERROR);
    expect(body(res).message).toContain('had a problem completing this run');
    // The raw upstream detail must never reach the client.
    expect(body(res).message).not.toContain('upstream boom');
  });

  it('maps an HttpException(400) to 400 + INVALID_INPUT', () => {
    const res = run(new HttpException('bad request', HttpStatus.BAD_REQUEST));
    expect(res.statusCode).toBe(HttpStatus.BAD_REQUEST);
    expect(body(res).code).toBe(ErrorCode.INVALID_INPUT);
    expect(body(res).message).toContain("weren't entered correctly");
  });

  it('maps an unknown Error to 500 + INTERNAL and hides the raw message', () => {
    const err = new Error('kaboom');
    const res = run(err);
    expect(res.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(body(res)).toEqual({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.INTERNAL,
      message: 'Something went wrong. Please try again.',
    });
    expect(body(res).message).not.toContain('kaboom');
    expect(body(res).message).not.toContain(err.message);
  });
});
