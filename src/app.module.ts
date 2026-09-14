import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './shared/prisma/prisma.module';
import { BlockchainModule } from './shared/blockchain/blockchain.module';
import { AiClientModule } from './shared/http/ai-client.module';
import { HealthModule } from './modules/health/health.module';
import { DemoModule } from './modules/demo/demo.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    BlockchainModule,
    AiClientModule,
    HealthModule,
    DemoModule,
  ],
})
export class AppModule {}
