import { Module } from '@nestjs/common';
import { AuthController } from './presentation/auth.controller';
import { LoginPlatformUserUseCase } from './application/login-platform-user.usecase';
import { GetMeUseCase } from './application/get-me.usecase';
import { CreateUserUseCase } from './application/create-user.usecase';
import { PrismaPlatformUserRepository } from './infrastructure/prisma-platform-user.repository';
import { PLATFORM_USER_REPOSITORY } from './domain/platform-user.repository';
import { AuthSharedModule } from '../../shared/auth/auth-shared.module';

@Module({
  imports: [AuthSharedModule],
  controllers: [AuthController],
  providers: [
    LoginPlatformUserUseCase,
    GetMeUseCase,
    CreateUserUseCase,
    {
      provide: PLATFORM_USER_REPOSITORY,
      useClass: PrismaPlatformUserRepository,
    },
  ],
})
export class AuthModule {}
