import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { ChargeSheet, ChargeSheetSummary } from '@tribunal/shared-types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChargeSheetsService } from './chargesheets.service';
import { PatchChargeSheetDto } from './dto/patch-charge-sheet.dto';

@ApiTags('charge-sheets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ChargeSheetsController {
  constructor(private readonly sheets: ChargeSheetsService) {}

  @Get('charge-sheet')
  @ApiOperation({ summary: 'Get the active charge sheet.' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'No active charge sheet.' })
  getActive(): Promise<ChargeSheet> {
    return this.sheets.getActive();
  }

  @Get('charge-sheets')
  @ApiOperation({ summary: 'List all charge sheets.' })
  @ApiResponse({ status: 200 })
  async list(): Promise<ChargeSheetSummary[]> {
    const all = await this.sheets.list();
    return all.map(({ id, title, isActive, updatedAt }) => ({
      id,
      title,
      isActive,
      updatedAt: updatedAt.toISOString(),
    }));
  }

  @Patch('charge-sheet/:id')
  @ApiOperation({
    summary:
      'Update a charge sheet (editable per D9; setting isActive:true deactivates others). Not surfaced in the v1 UI.',
  })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  update(
    @Param('id') id: string,
    @Body() dto: PatchChargeSheetDto,
  ): Promise<ChargeSheet> {
    return this.sheets.update(id, dto);
  }
}
