import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import type { UpdateChargeSheetRequest } from '@tribunal/shared-types';

/** `PATCH /charge-sheet/:id` body (SPEC §10, D9). */
export class PatchChargeSheetDto implements UpdateChargeSheetRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: 'Set true to make this the active charge sheet (deactivates others).' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
