import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FreeModel, ModelInfo } from '@tribunal/shared-types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModelsService } from './models.service';

@ApiTags('models')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('models')
export class ModelsController {
  constructor(private readonly models: ModelsService) {}

  @Get()
  @ApiOperation({
    summary: 'List usable OpenRouter models — free and paid — with pricing (cached).',
  })
  @ApiResponse({ status: 200, description: 'Usable text models, free-first then cheapest (SPEC §5.2).' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  all(): Promise<ModelInfo[]> {
    return this.models.getUsableModels();
  }

  @Get('free')
  @ApiOperation({ summary: 'List the live free OpenRouter models (cached).' })
  @ApiResponse({ status: 200, description: 'Free models, highest context first.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({
    status: 404,
    description:
      'No free models available — enable the OpenRouter free-endpoint privacy toggles (SPEC §5.3).',
  })
  free(): Promise<FreeModel[]> {
    return this.models.getFreeModels();
  }
}
