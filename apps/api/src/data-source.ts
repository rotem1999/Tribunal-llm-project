import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { ChargeSheet } from './chargesheets/charge-sheet.entity';
import { CreateChargeSheets } from './migrations/1787000001000-CreateChargeSheets';
import { CreateRuns } from './migrations/1787000002000-CreateRuns';
import { CreateUsers } from './migrations/1787000000000-CreateUsers';
import { Run } from './runs/run.entity';
import { Speech } from './runs/speech.entity';
import { Verdict } from './runs/verdict.entity';
import { User } from './users/user.entity';

/**
 * Standalone DataSource for the TypeORM CLI (migration generate/run/revert).
 * The Nest runtime uses its own config in database.module.ts; this mirrors it
 * for out-of-Nest tooling. Reads DATABASE_URL from the environment (.env).
 */
export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [User, ChargeSheet, Run, Speech, Verdict],
  migrations: [CreateUsers, CreateChargeSheets, CreateRuns],
  synchronize: false,
});
