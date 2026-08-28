import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChargeSheet } from './charge-sheet.entity';
import { ChargeSheetsController } from './chargesheets.controller';
import { ChargeSheetsService } from './chargesheets.service';

/** Charge-sheet domain (SPEC §4.2, §10): entity, seed, CRUD, active invariant. */
@Module({
  imports: [TypeOrmModule.forFeature([ChargeSheet])],
  controllers: [ChargeSheetsController],
  providers: [ChargeSheetsService],
  exports: [ChargeSheetsService],
})
export class ChargeSheetsModule {}
