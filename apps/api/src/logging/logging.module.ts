import { Global, Module } from '@nestjs/common';
import { LoggingService } from './logging.service';

/**
 * Diagnostic logging (SPEC §5.7). `@Global` so `LoggingService` injects into any
 * module (the OpenRouter client, the tribunal pipeline, the exception filter)
 * without re-importing — like `AppConfigModule`.
 */
@Global()
@Module({
  providers: [LoggingService],
  exports: [LoggingService],
})
export class LoggingModule {}
