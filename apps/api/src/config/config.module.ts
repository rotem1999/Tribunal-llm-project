import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config.schema';

/**
 * Global configuration module (SPEC §9).
 *
 * Loads env from `.env` (workspace root — `nx serve` runs from there) and
 * validates it with the zod schema in {@link validateEnv} before the app
 * starts. `isGlobal` makes `ConfigService` injectable everywhere without
 * re-importing. `cache` avoids re-reading `process.env` on every lookup.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      // Resolved from the Nx workspace root; real values live in .env (gitignored).
      envFilePath: ['.env'],
    }),
  ],
})
export class AppConfigModule {}
