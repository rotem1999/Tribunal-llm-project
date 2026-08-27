import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { ChargeSheet } from './chargesheets/charge-sheet.entity';
import { CreateChargeSheets } from './migrations/1787000001000-CreateChargeSheets';
import { CreateUsers } from './migrations/1787000000000-CreateUsers';
import { User } from './users/user.entity';

/**
 * Standalone DataSource for the TypeORM CLI (migration generate/run/revert).
 * The Nest runtime uses its own config in database.module.ts; this mirrors it
 * for out-of-Nest tooling. Reads DATABASE_URL from the environment (.env).
 */
export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [User, ChargeSheet],
  migrations: [CreateUsers, CreateChargeSheets],
  synchronize: false,
});
