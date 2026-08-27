import { Module } from '@nestjs/common';
import { OpenRouterClient } from './openrouter.client';

/** OpenRouter integration (SPEC §5). Exposes the chat wrapper; the model-list
 * resolution + endpoint land in the next PR. */
@Module({
  providers: [OpenRouterClient],
  exports: [OpenRouterClient],
})
export class OpenRouterModule {}
