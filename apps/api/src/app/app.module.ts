import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChargeSheetsModule } from '../chargesheets/chargesheets.module';
import { AppConfigModule } from '../config/config.module';
import { DatabaseModule } from '../database/database.module';
import { OpenRouterModule } from '../openrouter/openrouter.module';
import { PersonasModule } from '../personas/personas.module';
import { TribunalModule } from '../tribunal/tribunal.module';
import { UsersModule } from '../users/users.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    UsersModule,
    AuthModule,
    OpenRouterModule,
    PersonasModule,
    ChargeSheetsModule,
    TribunalModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
