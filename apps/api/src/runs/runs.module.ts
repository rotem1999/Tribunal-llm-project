import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EconomyModule } from '../economy/economy.module';
import { TribunalModule } from '../tribunal/tribunal.module';
import { Run } from './run.entity';
import { RunsController } from './runs.controller';
import { RunsService } from './runs.service';
import { Speech } from './speech.entity';
import { Verdict } from './verdict.entity';

/** Run endpoints (SPEC §10): POST /runs, GET /runs, GET /runs/:id. */
@Module({
  imports: [
    TypeOrmModule.forFeature([Run, Speech, Verdict]),
    TribunalModule,
    EconomyModule,
  ],
  controllers: [RunsController],
  providers: [RunsService],
})
export class RunsModule {}
