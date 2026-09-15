import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/prisma/prisma.service';
import { APP_CONFIG } from '../src/config/configuration';
import type { AppConfig } from '../src/config/configuration';
import { hashPassword } from '../src/modules/auth/infrastructure/password.util';
import { ACCESS_TOKEN_COOKIE } from '../src/shared/auth/auth-cookie';

function extractCookie(setCookieHeader: string[] | undefined): string {
  const raw = (setCookieHeader ?? []).find((c) =>
    c.startsWith(`${ACCESS_TOKEN_COOKIE}=`),
  );
  if (!raw) {
    throw new Error('No se encontro la cookie access_token en la respuesta');
  }
  return raw.split(';')[0];
}

describe('auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let config: AppConfig;
  const email = `e2e-auth-${Date.now()}@themis.dev`;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    config = app.get<AppConfig>(APP_CONFIG);

    await prisma.platformUser.create({
      data: {
        email,
        passwordHash: await hashPassword('clave-e2e'),
        nombreCompleto: 'Usuario E2E Auth',
        role: 'ADMIN',
      },
    });
  });

  afterAll(async () => {
    await prisma.platformUser.deleteMany({ where: { email } });
    await app.close();
  });

  it('POST /auth/login responde 200 con role/nombreCompleto y una cookie httpOnly access_token (AC-01)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'clave-e2e' });

    expect(response.status).toBe(200);
    expect(response.body.role).toBe('ADMIN');
    expect(response.body.nombreCompleto).toBe('Usuario E2E Auth');
    expect(response.body.accessToken).toBeUndefined();

    const cookieHeader = (response.headers['set-cookie'] as unknown as
      | string[]
      | undefined) ?? [];
    const authCookie = cookieHeader.find((c) =>
      c.startsWith(`${ACCESS_TOKEN_COOKIE}=`),
    );
    expect(authCookie).toBeDefined();
    expect(authCookie).toMatch(/HttpOnly/i);
  });

  it('POST /auth/login responde 401 para credenciales invalidas (AC-02)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'incorrecta' });

    expect(response.status).toBe(401);
  });

  it('GET /auth/me responde 200 con la sesion cuando la cookie es valida', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'clave-e2e' });

    const cookie = extractCookie(
      login.headers['set-cookie'] as unknown as string[] | undefined,
    );

    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body.role).toBe('ADMIN');
    expect(response.body.nombreCompleto).toBe('Usuario E2E Auth');
  });

  it('GET /auth/me responde 401 sin cookie', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/auth/me');
    expect(response.status).toBe(401);
  });

  it('GET /auth/me responde 401 con una cookie de token expirado (AC-04)', async () => {
    const jwtService = new JwtService({ secret: config.jwt.secret });
    const expiredToken = await jwtService.signAsync(
      { sub: 'x', role: 'ADMIN' },
      { expiresIn: '-10s' },
    );

    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', `${ACCESS_TOKEN_COOKIE}=${expiredToken}`);

    expect(response.status).toBe(401);
  });

  it('POST /auth/logout limpia la cookie de sesion', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'clave-e2e' });

    const cookie = extractCookie(
      login.headers['set-cookie'] as unknown as string[] | undefined,
    );

    const logout = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', cookie);

    expect(logout.status).toBe(200);
    const clearedCookie = (logout.headers['set-cookie'] as unknown as
      | string[]
      | undefined) ?? [];
    const cleared = clearedCookie.find((c) =>
      c.startsWith(`${ACCESS_TOKEN_COOKIE}=`),
    );
    // clearCookie envia el valor vacio con Expires en el pasado.
    expect(cleared).toMatch(new RegExp(`${ACCESS_TOKEN_COOKIE}=;`));
  });

  it('POST /auth/register no existe (AC-05, sin auto-registro)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'nuevo@themis.dev', password: 'x' });

    expect(response.status).toBe(404);
  });
});
