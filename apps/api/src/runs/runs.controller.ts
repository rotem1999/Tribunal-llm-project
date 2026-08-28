import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type {
  AuthUser,
  CreateRunResponse,
  RunDetail,
  RunSummary,
} from '@tribunal/shared-types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateRunDto } from './dto/create-run.dto';
import { RunsService } from './runs.service';

interface RequestWithUser {
  user: AuthUser;
}

@ApiTags('runs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('runs')
export class RunsController {
  constructor(private readonly runs: RunsService) {}

  @Post()
  @ApiOperation({ summary: 'Start a run (executes synchronously; SPEC §10.1).' })
  @ApiResponse({ status: 201, description: 'Run completed — returns runId.' })
  @ApiResponse({ status: 401 })
  @ApiResponse({ status: 402, description: 'OpenRouter out of credits.' })
  @ApiResponse({ status: 404, description: 'No free models (data policy).' })
  create(
    @Req() req: RequestWithUser,
    @Body() dto: CreateRunDto,
  ): Promise<CreateRunResponse> {
    return this.runs.create(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List run summaries.' })
  @ApiResponse({ status: 200 })
  list(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<RunSummary[]> {
    return this.runs.list(
      limit ? Number(limit) : undefined,
      offset ? Number(offset) : undefined,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Full run: charge, 4 speeches, 3 verdicts, economy, non-binding tally.',
  })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  getOne(@Param('id') id: string): Promise<RunDetail> {
    return this.runs.getDetail(id);
  }
}
