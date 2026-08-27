import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { RunMode, type CreateRunRequest } from '@tribunal/shared-types';

/** `POST /runs` body (SPEC §10). No charge-sheet text — the server loads it. */
export class CreateRunDto implements CreateRunRequest {
  @ApiProperty({ enum: RunMode })
  @IsEnum(RunMode)
  mode!: RunMode;

  @ApiPropertyOptional({ description: 'Mode A only: pin the single model.' })
  @IsOptional()
  @IsString()
  modelSingle?: string;

  @ApiPropertyOptional({ description: 'Defaults to the active charge sheet.' })
  @IsOptional()
  @IsUUID()
  chargeSheetId?: string;
}
