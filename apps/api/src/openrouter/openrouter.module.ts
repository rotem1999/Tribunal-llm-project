import { Module } from '@nestjs/common';
import { ModelsController } from './models.controller';
import { ModelsService } from './models.service';
import { OpenRouterClient } from './openrouter.client';

/** OpenRouter integration (SPEC §5): the chat wrapper, free-model resolution,
 * and the `/models/free` endpoint. */
@Module({
  controllers: [ModelsController],
  providers: [OpenRouterClient, ModelsService],
  exports: [OpenRouterClient, ModelsService],
})
export class OpenRouterModule {}
