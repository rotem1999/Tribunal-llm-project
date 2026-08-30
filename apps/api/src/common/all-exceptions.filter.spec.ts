import { describe, expect, it, jest } from '@jest/globals';
import {
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import {
  DataPolicyError,
  ModelUnavailableError,
  OpenRouterError,
  OutOfCreditsError,
  RateLimitError,
} from '../openrouter/openrouter.errors';

/**
 * Maps domain errors to HTTP responses (SPEC §12). No real HTTP: a fake
 * Express Response records status()/json(), and a minimal ArgumentsHost hands
 * it to the filter. We assert the status code and surfaced message per error.
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

describe('AllExceptionsFilter — ModelUnavailableError', () => {
  it('maps ModelUnavailableError to 422 Unprocessable Entity with its message', () => {
    const err = new ModelUnavailableError('gated/model');
    const res = run(err);
    expect(res.statusCode).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({
      statusCode: 422,
      message: err.message,
    });
  });

  it('surfaces the custom "every free model" message from the service variant', () => {
    const err = new ModelUnavailableError(
      'free/top',
      'Every free model was rejected as restricted/unavailable for this account.',
    );
    const res = run(err);
    expect(res.statusCode).toBe(422);
    expect((res.body as { message: string }).message).toMatch(
      /every free model was rejected/i,
    );
  });

  it('does NOT fall through to the OpenRouterError 502 branch (subclass ordering)', () => {
    // ModelUnavailableError extends OpenRouterError; the filter must match the
    // more specific branch first and return 422, not 502.
    const res = run(new ModelUnavailableError('x/y'));
    expect(res.statusCode).not.toBe(HttpStatus.BAD_GATEWAY);
    expect(res.statusCode).toBe(422);
  });
});

describe('AllExceptionsFilter — other domain errors (regression)', () => {
  it('maps DataPolicyError to 404 Not Found with its message', () => {
    const err = new DataPolicyError();
    const res = run(err);
    expect(res.statusCode).toBe(HttpStatus.NOT_FOUND);
    expect((res.body as { message: string }).message).toBe(err.message);
  });

  it('maps OutOfCreditsError to 402 Payment Required', () => {
    const res = run(new OutOfCreditsError());
    expect(res.statusCode).toBe(HttpStatus.PAYMENT_REQUIRED);
  });

  it('maps RateLimitError to 429 Too Many Requests', () => {
    const res = run(new RateLimitError());
    expect(res.statusCode).toBe(HttpStatus.TOO_MANY_REQUESTS);
  });

  it('maps a plain OpenRouterError to 502 Bad Gateway', () => {
    const res = run(new OpenRouterError('upstream boom', 503));
    expect(res.statusCode).toBe(HttpStatus.BAD_GATEWAY);
    expect((res.body as { message: string }).message).toBe('upstream boom');
  });

  it('passes an HttpException through unchanged', () => {
    const res = run(new HttpException('bad request', HttpStatus.BAD_REQUEST));
    expect(res.statusCode).toBe(HttpStatus.BAD_REQUEST);
  });

  it('maps an unknown Error to 500 Internal Server Error', () => {
    const res = run(new Error('kaboom'));
    expect(res.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(res.body).toEqual({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'kaboom',
    });
  });
});
