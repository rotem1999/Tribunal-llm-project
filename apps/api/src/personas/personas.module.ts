import { Module } from '@nestjs/common';
import { PersonasService } from './personas.service';

/** Personas domain (SPEC §8): loads + validates personalities.json at boot. */
@Module({
  providers: [PersonasService],
  exports: [PersonasService],
})
export class PersonasModule {}
