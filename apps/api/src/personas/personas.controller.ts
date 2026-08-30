import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { PersonaInfo } from '@tribunal/shared-types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PersonasService } from './personas.service';

/** Persona roster for display + the run animation (SPEC §10, §11). No systemPrompt. */
@ApiTags('personas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('personas')
export class PersonasController {
  constructor(private readonly personas: PersonasService) {}

  @Get()
  @ApiOperation({ summary: 'Roster: [{ key, name, role, side? }] (no systemPrompt).' })
  @ApiResponse({ status: 200 })
  list(): PersonaInfo[] {
    return this.personas.getRoster();
  }
}
