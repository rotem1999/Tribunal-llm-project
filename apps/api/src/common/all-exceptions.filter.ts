import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ApiErrorBody } from '@tribunal/shared-types';
import type { LoggingService } from '../logging/logging.service';
import { classifyError } from './classify-error';

/**
 * Turns every failure into the one user-safe error body (SPEC §12.1):
 * `{ statusCode, code, message }`, where `code` is a stable `ErrorCode` and
 * `message` is plain and non-technical — never a raw exception or model output.
 * Classification is delegated to {@link classifyError} (shared with the run
 * pipeline). The raw cause of a genuinely unexpected (5xx) failure is written to
 * the §5.7 diagnostic log and the console, but never sent to the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  /**
   * `logging` is optional so the filter can be `new`ed directly (unit tests);
   * `main.ts` passes the app's {@link LoggingService} so unhandled errors also
   * land in the diagnostic log (SPEC §5.7).
   */
  constructor(private readonly logging?: LoggingService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const { status, code, message } = classifyError(exception);

    // Keep the raw cause for genuinely unexpected failures — in the log, never
    // in the response (SPEC §12.1). Client 4xx are expected and not logged here.
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      if (exception instanceof Error) this.logger.error(exception.stack);
      this.logging?.logUnhandledError(exception, message);
    }

    const body: ApiErrorBody = { statusCode: status, code, message };
    res.status(status).json(body);
  }
}
