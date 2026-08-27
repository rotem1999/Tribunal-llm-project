import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { User } from './users/user.entity';
import { CreateUsers } from './migrations/1787000000000-CreateUsers';

/**
 * Standalone DataSource for the TypeORM CLI (migration generate/run/revert).
 * The Nest runtime uses its own config in database.module.ts; this mirrors it
 * for out-of-Nest tooling. Reads DATABASE_URL from the environment (.env).
 *
 * e.g. `typeorm-ts-node-esm migration:generate -d apps/api/src/data-source.ts …`
 */
export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [User],
  migrations: [CreateUsers],
  synchronize: false,
});
