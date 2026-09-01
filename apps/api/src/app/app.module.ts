import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChargeSheetsModule } from '../chargesheets/chargesheets.module';
import { AppConfigModule } from '../config/config.module';
import { DatabaseModule } from '../database/database.module';
import { EconomyModule } from '../economy/economy.module';
import { LoggingModule } from '../logging/logging.module';
import { OpenRouterModule } from '../openrouter/openrouter.module';
import { PersonasModule } from '../personas/personas.module';
import { RunsModule } from '../runs/runs.module';
import { TribunalModule } from '../tribunal/tribunal.module';
import { UsersModule } from '../users/users.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    AppConfigModule,
    LoggingModule,
    DatabaseModule,
    UsersModule,
    AuthModule,
    OpenRouterModule,
    PersonasModule,
    ChargeSheetsModule,
    EconomyModule,
    TribunalModule,
    RunsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
