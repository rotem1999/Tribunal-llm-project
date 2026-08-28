import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { LedgerEntry } from '@tribunal/shared-types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EconomyService } from './economy.service';

@ApiTags('economy')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class EconomyController {
  constructor(private readonly economy: EconomyService) {}

  @Get('runs/:id/economy')
  @ApiOperation({ summary: "Download a run's economy JSON." })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  async runEconomy(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const economy = await this.economy.buildForRun(id);
    res
      .header('Content-Type', 'application/json')
      .header('Content-Disposition', `attachment; filename="run-${id}.json"`)
      .send(JSON.stringify(economy, null, 2));
  }

  @Get('economy/ledger')
  @ApiOperation({ summary: 'The cumulative run ledger.' })
  @ApiResponse({ status: 200 })
  ledger(): Promise<LedgerEntry[]> {
    return this.economy.ledger();
  }
}
