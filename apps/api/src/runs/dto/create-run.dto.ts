import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { RunMode, type CreateRunRequest } from '@tribunal/shared-types';

/** `POST /runs` body (SPEC §10). No charge-sheet text — the server loads it. */
export class CreateRunDto implements CreateRunRequest {
  @ApiProperty({ enum: RunMode })
  @IsEnum(RunMode)
  mode!: RunMode;

  @ApiPropertyOptional({ description: 'Mode A only: pin the single model (free or paid).' })
  @IsOptional()
  @IsString()
  modelSingle?: string;

  @ApiPropertyOptional({
    description:
      'Mode B only: a { personaKey → modelId } map. The UI sends all 7; when omitted the server auto-assigns free models (SPEC §5.2).',
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  @IsOptional()
  @IsObject()
  modelByPersona?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Defaults to the active charge sheet.' })
  @IsOptional()
  @IsUUID()
  chargeSheetId?: string;
}
