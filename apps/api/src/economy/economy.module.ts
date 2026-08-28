import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Run } from '../runs/run.entity';
import { Speech } from '../runs/speech.entity';
import { Verdict } from '../runs/verdict.entity';
import { EconomyController } from './economy.controller';
import { EconomyService } from './economy.service';

/** Token economy (SPEC §6): per-run JSON + ledger writer/reader + endpoints. */
@Module({
  imports: [TypeOrmModule.forFeature([Run, Speech, Verdict])],
  controllers: [EconomyController],
  providers: [EconomyService],
  exports: [EconomyService],
})
export class EconomyModule {}
