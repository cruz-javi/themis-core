# themis-core

Backend (NestJS), relayer y contratos inteligentes (Solidity/Hardhat) de Themis. Contexto de producto completo en [`../docs/diseno-consolidado.md`](../docs/diseno-consolidado.md) — leer eso primero si falta contexto de negocio.

## Stack

Node 22, pnpm 11, NestJS 12, Prisma 6 (Postgres), Hardhat 2 + ethers (Solidity), passport-jwt, zod (validación de env).

## Arranque local

```bash
pnpm install
cp .env.example .env   # rellenar segun docs/UT o preguntar al equipo
pnpm prisma:generate
pnpm prisma:migrate
```

Necesita 3 procesos corriendo en paralelo:

```bash
pnpm chain:node              # terminal 1: nodo Hardhat local (:8545)
pnpm chain:deploy:local       # terminal 2: una vez por arranque del nodo -> copiar address a CONTRACT_ADDRESS en .env
pnpm start:dev                 # terminal 3: backend (:3000)
```

- API: `http://localhost:3000/api/v1`
- Swagger: `http://localhost:3000/docs`

**La base de datos es Neon** (`DATABASE_URL` pooled + `DIRECT_URL` unpooled en `.env`, ver `.env.example`) — es la decisión de diseño del equipo, y `docker-compose.yml` **no** trae ningún servicio Postgres a propósito. Si el proyecto Neon del equipo todavía no existe y necesitas avanzar de todas formas, correr un Postgres local es válido, pero **solo como algo personal**: crea un `docker-compose.override.yml` (ya en `.gitignore`, Docker Compose lo combina automáticamente con `docker-compose.yml` si existe) con tu propio servicio `db`, y apunta tu `.env` local ahí — nunca agregues ese servicio al `docker-compose.yml` compartido, porque el resto del equipo asume que todos trabajan contra el mismo Neon.

**Trampa conocida — Postgres local en Windows:** si usas el override de arriba y tienes múltiples versiones de Postgres instaladas como servicio de Windows (común si instalaste varias con el instalador EDB), pueden estar ocupando 5432, 5433, 5434... antes de que Docker intente mapear su propio contenedor. Antes de asumir que `DATABASE_URL` está mal, correr `Get-NetTCPConnection -LocalPort <puerto>` y `Get-Process -Id <pid>` para confirmar quién responde de verdad en ese puerto, y remapear el puerto en tu override.

## Arquitectura de módulos (`src/modules/*`)

`src/modules/demo/` es la plantilla de referencia — copiarla como punto de partida para un módulo nuevo. Cuatro capas, regla de dependencia estricta:

| Capa | Contiene | Puede importar de |
|---|---|---|
| `domain/` | Entidades e interfaces de repositorio | nada |
| `application/` | Casos de uso | `domain/` |
| `infrastructure/` | Implementaciones con Prisma/ethers | `domain/` |
| `presentation/` | Controllers y DTOs | `application/` |

`domain/` no importa nada de las otras capas. Los casos de uso reciben la interfaz del repositorio (token de inyección definido en `domain/*.repository.ts`), nunca la clase concreta. El wiring vive en el `*.module.ts` de cada módulo.

## Trampa conocida — `AuthSharedModule` vs. `PassportModule` directo

Si un módulo nuevo necesita `@UseGuards(JwtAuthGuard)` o `RolesGuard`/`@Roles(...)`, **importar `AuthSharedModule`** (`src/shared/auth/auth-shared.module.ts`), nunca registrar `PassportModule.register(...)` de nuevo en el módulo propio. `AuthSharedModule` ya trae `JwtStrategy` correctamente cableada con `JwtModule.registerAsync` (usa `config.jwt.secret` desde `APP_CONFIG`). Una segunda registración de Passport en otro módulo rompe la resolución de dependencias de la strategy — el síntoma es `UnknownDependenciesException: AuthModuleOptions` al arrancar. Ver `AuthModule` (`src/modules/auth/auth.module.ts`) como ejemplo correcto: solo importa `AuthSharedModule`.

## Los dos sistemas de auth — no confundir

Son independientes, con propósitos distintos. Ver [`src/modules/auth/README.md`](src/modules/auth/README.md) y [`src/modules/mock-sso/README.md`](src/modules/mock-sso/README.md) para el detalle completo de cada uno.

- **`src/modules/auth/`** (HU00_1) — sesión del equipo Admin/Autoridad/Auditor que opera el portal web. JWT viaja en **cookie httpOnly** (`access_token`), nunca en `Authorization: Bearer` ni en el body. `JwtStrategy` lee de `req.cookies`, no de headers.
- **`src/modules/mock-sso/`** (HU-00) — simula el SSO institucional real de la universidad (no disponible durante el piloto). **Andamiaje temporal**: se retira el día que exista integración real, sin tocar el contrato `scoped_token_hash` documentado en `docs/UT/HU00/UT-CORE/README.md`. Usado por CU-05 (registro del votante, ver `src/modules/registration/README.md`). Seed: `pnpm run seed:mock-sso`, password única `123123`, códigos fijos reproducibles documentados en su README (`220999999` habilitado, `221000000` inactivo, `221004999` no-estudiante).

Cuenta seed de plataforma (`pnpm run seed:platform-users`): `admin@themis.dev` / `autoridad@themis.dev` / `auditor@themis.dev` / `superusuario@themis.dev`, todas con password `123123`. `SUPERUSUARIO` es el único rol sin ruta de auto-creación — las otras tres cuentas se crean desde `POST /auth/users` (guardado con `RolesGuard`, solo `SUPERUSUARIO`), ver `src/modules/auth/README.md`.

## Endpoints de andamiaje temporal (borrar cuando empiecen los módulos reales)

`GET /health`, `POST|GET /demo/pings`, `GET /demo/forecast`, `GET /demo/chain`, `POST /demo/chain/ping`. `mock-sso/login`, `auth/*`, `elections/*` y `registration/*` (registro CU-05, ver su README) **no** son andamiaje — son CU reales, con tests.

## Puertos y variables clave

| Puerto | Servicio |
|---|---|
| 3000 | API NestJS |
| 8545 | Hardhat node local |
| 5432 (o el que esté libre) | Postgres (docker-compose `db`, solo dev local; producción usa Neon con `DATABASE_URL` pooled + `DIRECT_URL` unpooled) |

`AI_SERVICE_TOKEN` (aquí) debe ser el mismo valor que `SERVICE_TOKEN` en `themis-ai/.env`. `JWT_SECRET` y `SSO_MOCK_SECRET` son locales a este repo, sin necesidad de coincidir con nada externo. `REGISTRATION_SIGNING_PRIVATE_KEY_JWK`/`REGISTRATION_SIGNING_PUBLIC_KEY_JWK` (firma ciega de CU-05) se generan con `pnpm registration:generate-signing-key` — ver `src/modules/registration/README.md`.

## Scripts útiles

`pnpm test` / `pnpm run test:e2e` (Jest + Supertest, e2e requiere Postgres real), `pnpm prisma:studio` (explorador visual de la BD), `pnpm chain:compile`.

Los tests corren con `--experimental-vm-modules` (ya en los scripts) porque las dependencias `@nestjs/*` de este stack se resuelven como ESM y Jest 30 solo puede `require()` ESM síncronamente con esa flag.

## Documentación de historias de usuario

Los READMEs de varios módulos referencian `docs/HU/*.md` y `docs/UT/**/README.md` (historias de usuario y casos de uso técnicos) — esa carpeta `docs/` **todavía no existe en este repo**. Si se crea, debería vivir en `themis-core/docs/`, separada de `../docs/` (la carpeta a nivel de todo el workspace, que solo tiene el documento de diseño consolidado del producto).
