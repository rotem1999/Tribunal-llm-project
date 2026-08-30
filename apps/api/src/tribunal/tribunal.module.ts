import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChargeSheetsModule } from '../chargesheets/chargesheets.module';
import { EconomyModule } from '../economy/economy.module';
import { OpenRouterModule } from '../openrouter/openrouter.module';
import { PersonasModule } from '../personas/personas.module';
import { Run } from '../runs/run.entity';
import { Speech } from '../runs/speech.entity';
import { Verdict } from '../runs/verdict.entity';
import { TribunalService } from './tribunal.service';

/** Run orchestration (SPEC §5.5): advocates → judges → 3 verdicts + economy. */
@Module({
  imports: [
    TypeOrmModule.forFeature([Run, Speech, Verdict]),
    OpenRouterModule,
    PersonasModule,
    ChargeSheetsModule,
    EconomyModule,
  ],
  providers: [TribunalService],
  exports: [TribunalService],
})
export class TribunalModule {}
