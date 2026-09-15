import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { LoginPlatformUserUseCase } from '../application/login-platform-user.usecase';
import { GetMeUseCase } from '../application/get-me.usecase';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { MeResponseDto } from './dto/me-response.dto';
import { JwtAuthGuard } from '../../../shared/auth/jwt-auth.guard';
import { CurrentUser } from '../../../shared/auth/current-user.decorator';
import { RequestUser } from '../../../shared/auth/jwt.strategy';
import {
  ACCESS_TOKEN_COOKIE,
  buildAccessTokenCookieOptions,
} from '../../../shared/auth/auth-cookie';
import { APP_CONFIG } from '../../../config/configuration';
import type { AppConfig } from '../../../config/configuration';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginPlatformUser: LoginPlatformUserUseCase,
    private readonly getMe: GetMeUseCase,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Login de Administrador/Autoridad/Auditor: emite la sesion en una cookie httpOnly (HU00_1)',
  })
  @ApiResponse({ status: 200, type: LoginResponseDto })
  @ApiResponse({ status: 401, description: 'Credenciales invalidas' })
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const result = await this.loginPlatformUser.execute({
      email: body.email,
      password: body.password,
    });

    res.cookie(
      ACCESS_TOKEN_COOKIE,
      result.accessToken,
      buildAccessTokenCookieOptions(this.config.nodeEnv === 'production'),
    );

    return { role: result.role, nombreCompleto: result.nombreCompleto };
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Limpia la cookie de sesion' })
  @ApiResponse({ status: 200 })
  logout(@Res({ passthrough: true }) res: Response): { ok: true } {
    res.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Devuelve la sesion actual a partir de la cookie' })
  @ApiResponse({ status: 200, type: MeResponseDto })
  @ApiResponse({ status: 401, description: 'Sin sesion o sesion expirada' })
  async me(@CurrentUser() user: RequestUser): Promise<MeResponseDto> {
    return this.getMe.execute(user.sub);
  }
}
