import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  DataPolicyError,
  ModelUnavailableError,
  OpenRouterError,
  OutOfCreditsError,
  RateLimitError,
} from '../openrouter/openrouter.errors';

/**
 * Maps domain errors to the right HTTP responses (SPEC §12). The §5.3
 * data-policy 404 surfaces its actionable message rather than a generic 500;
 * 402 out-of-credits and 429 rate-limit are surfaced honestly. HttpExceptions
 * (incl. ValidationPipe 400s) pass through unchanged.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      res.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof DataPolicyError) {
      status = HttpStatus.NOT_FOUND;
      message = exception.message;
    } else if (exception instanceof ModelUnavailableError) {
      // Restricted/unavailable model(s) — actionable, not a generic 502.
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      message = exception.message;
    } else if (exception instanceof OutOfCreditsError) {
      status = HttpStatus.PAYMENT_REQUIRED;
      message = exception.message;
    } else if (exception instanceof RateLimitError) {
      status = HttpStatus.TOO_MANY_REQUESTS;
      message = exception.message;
    } else if (exception instanceof OpenRouterError) {
      status = HttpStatus.BAD_GATEWAY;
      message = exception.message;
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(exception.stack);
    }

    res.status(status).json({ statusCode: status, message });
  }
}
