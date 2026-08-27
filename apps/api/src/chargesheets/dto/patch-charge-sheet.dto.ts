import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import type { UpdateChargeSheetRequest } from '@tribunal/shared-types';

/** Cap charge-sheet size to bound token spend + prompt-injection surface (SPEC §13). */
const MAX_CONTENT_CHARS = 50_000;

/** `PATCH /charge-sheet/:id` body (SPEC §10, D9). */
export class PatchChargeSheetDto implements UpdateChargeSheetRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ maxLength: MAX_CONTENT_CHARS })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_CONTENT_CHARS)
  content?: string;

  @ApiPropertyOptional({ description: 'Set true to make this the active charge sheet (deactivates others).' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
