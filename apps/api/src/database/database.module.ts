import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreateChargeSheets } from '../migrations/1787000001000-CreateChargeSheets';
import { CreateRuns } from '../migrations/1787000002000-CreateRuns';
import { AddRunErrorCode } from '../migrations/1787000003000-AddRunErrorCode';
import { CreateUsers } from '../migrations/1787000000000-CreateUsers';

/**
 * Postgres connection (SPEC §4). `synchronize` is OFF — schema changes go
 * through migrations, which run automatically on boot (`migrationsRun`).
 * Entities are auto-loaded from each domain module's `forFeature`, so only the
 * migrations list grows as the schema evolves.
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.getOrThrow<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: false,
        migrationsRun: true,
        migrations: [CreateUsers, CreateChargeSheets, CreateRuns, AddRunErrorCode],
      }),
    }),
  ],
})
export class DatabaseModule {}
