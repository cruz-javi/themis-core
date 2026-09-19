# themis-core

Backend, relayer y contratos inteligentes de Themis.

## Requisitos

| Herramienta | Version |
|---|---|
| Node | 22 LTS (ver `.nvmrc`) |
| pnpm | 11.x (`corepack enable`) |
| Docker | opcional, solo para el nodo local en contenedor |

## Arranque

```bash
pnpm install
cp .env.example .env
```

Rellena `.env` con tus credenciales de Neon. Necesitas **dos** cadenas:

- `DATABASE_URL`: la **pooled**, el host lleva `-pooler`. La usa la aplicacion en runtime.
- `DIRECT_URL`: la **unpooled**, el mismo host sin `-pooler`. La usan las migraciones.

No incluyas `channel_binding=require` en `DATABASE_URL`. El motor nativo de Prisma no lo soporta y devuelve `P1001`.

Luego:

```bash
pnpm prisma:generate
pnpm prisma:migrate
```

Necesitas tres terminales:

```bash
# 1 - nodo blockchain local
pnpm chain:node

# 2 - desplegar los contratos, en este orden (una vez por arranque del nodo)
pnpm chain:deploy:local
pnpm chain:deploy:semaphore:local
# copia las direcciones que imprimen en CONTRACT_ADDRESS y SEMAPHORE_REGISTRY_ADDRESS del .env

# 3 - el backend
pnpm start:dev
```

Si reinicias el nodo, repite los dos deploys: Hardhat pierde todo su estado. Para probar el flujo completo
(registro, lotes, aprobacion, insercion on-chain) ver [`docs/guia-prueba-end-to-end.md`](docs/guia-prueba-end-to-end.md).

- API: http://localhost:3000/api/v1
- Swagger: http://localhost:3000/docs

## Variables de entorno

| Variable | Para que sirve |
|---|---|
| `NODE_ENV` | `development`, `test` o `production` |
| `PORT` | Puerto HTTP |
| `API_PREFIX` | Prefijo de todas las rutas |
| `CORS_ORIGINS` | Origenes permitidos, separados por coma |
| `DATABASE_URL` | Neon pooled, para runtime |
| `DIRECT_URL` | Neon unpooled, para migraciones |
| `JWT_SECRET` | Firma de tokens de autoridades (minimo 16 caracteres) |
| `AI_SERVICE_URL` | URL de themis-ai |
| `AI_SERVICE_TOKEN` | Debe coincidir con `SERVICE_TOKEN` de themis-ai |
| `AI_SERVICE_TIMEOUT_MS` | Timeout al llamar a themis-ai |
| `RPC_URL` | Endpoint JSON-RPC de la blockchain |
| `CHAIN_ID` | 31337 en local |
| `RELAYER_PRIVATE_KEY` | Clave que paga el gas |
| `CONTRACT_ADDRESS` | Direccion del contrato desplegado |
| `SEMAPHORE_REGISTRY_ADDRESS` | Direccion de `ThemisSemaphoreRegistry`, el contrato donde se insertan los lotes (CU-09) |
| `SSO_MOCK_SECRET` | Firma HMAC de las assertions del mock SSO (HU-00), minimo 32 caracteres |
| `SSO_MOCK_TOKEN_TTL_SECONDS` | Tiempo de vida de esas assertions, en segundos |

El arranque falla con un mensaje explicito si falta alguna. La validacion vive en `src/config/env.validation.ts`.

## Estructura

```
contracts/            Solidity
scripts/deploy.ts     Despliegue
deployments/          Direcciones por red
prisma/               Esquema y migraciones
src/config/           Configuracion validada con zod
src/shared/           Prisma, blockchain y cliente de themis-ai
src/modules/health/   Estado de las dependencias
src/modules/demo/     Modulo de ejemplo con las 4 capas
src/modules/mock-sso/ Simulacion del SSO institucional (HU-00, ver su propio README)
src/modules/auth/     Login de Administrador/Autoridad/Auditor (HU00_1, ver su propio README)
```

`src/shared/auth/` (transversal, no es un modulo) provee `JwtAuthGuard`, `RolesGuard` y
`@Roles(...)` para que cualquier modulo futuro proteja sus propios endpoints sin reimplementar la
verificacion de JWT. Ver la trampa conocida sobre `PassportModule.register(...)` en el CLAUDE.md
raiz si un modulo nuevo falla al arrancar con `UnknownDependenciesException: AuthModuleOptions`.

### El patron de los modulos

`src/modules/demo/` es la plantilla. Cada modulo se organiza en cuatro capas:

| Capa | Contiene | Depende de |
|---|---|---|
| `domain/` | Entidades e interfaces de repositorio | nada |
| `application/` | Casos de uso | `domain/` |
| `infrastructure/` | Implementaciones con Prisma o ethers | `domain/` |
| `presentation/` | Controllers y DTOs | `application/` |

La regla: `domain/` no importa nada de las otras capas. Los casos de uso reciben la interfaz, no la implementacion. El wiring se hace en el `*.module.ts` con un token de inyeccion.

## Endpoints de verificacion

Son andamiaje temporal. Borralos cuando empieces los modulos reales.

| Endpoint | Que prueba |
|---|---|
| `GET /api/v1/health` | Neon, blockchain y themis-ai responden |
| `POST /api/v1/demo/pings` | Escritura en Neon vias Prisma |
| `GET /api/v1/demo/pings` | Lectura desde Neon |
| `GET /api/v1/demo/forecast` | Llamada a themis-ai con degradacion elegante |
| `GET /api/v1/demo/chain` | Lectura del contrato |
| `POST /api/v1/demo/chain/ping` | Transaccion firmada por el relayer |

`POST /api/v1/mock-sso/login` no es andamiaje temporal: es HU-00, precursor real de CU-05. Ver
`src/modules/mock-sso/README.md` para las credenciales de prueba sembradas.

`POST /api/v1/auth/login`, `GET /api/v1/auth/me` y `POST /api/v1/auth/logout` tampoco son
andamiaje: es HU00_1, la autenticación real de Administrador/Autoridad/Auditor. La sesión viaja en
una cookie `httpOnly` (`access_token`), nunca en el body de la respuesta ni en un header
`Authorization` — ver `src/modules/auth/README.md` para las credenciales de prueba sembradas.

## Docker

```bash
docker compose up --build
```

Levanta el nodo Hardhat y el backend. La base de datos siempre es Neon, no hay Postgres en el compose.

## Scripts

| Comando | Que hace |
|---|---|
| `pnpm start:dev` | Backend con recarga en caliente |
| `pnpm build` | Compila a `dist/` |
| `pnpm lint` | Chequeo de tipos |
| `pnpm test` | Tests unitarios (Jest) |
| `pnpm run test:e2e` | Tests end-to-end (Jest + Supertest, contra Postgres real) |
| `pnpm prisma:migrate` | Crea y aplica una migracion |
| `pnpm prisma:studio` | Explorador visual de la base de datos |
| `pnpm run seed:mock-sso` | Siembra usuarios de prueba del mock SSO (HU-00) |
| `pnpm run seed:platform-users` | Siembra cuentas de prueba de Admin/Autoridad/Auditor (HU00_1) |
| `pnpm chain:node` | Nodo blockchain local |
| `pnpm chain:compile` | Compila los contratos |
| `pnpm chain:deploy:local` | Despliega `ThemisRegistry` en el nodo local |
| `pnpm chain:deploy:semaphore:local` | Despliega el registro Semaphore (verificador + Poseidon + `ThemisSemaphoreRegistry`) |
| `pnpm run test:manual-flow` | Prueba manual de punta a punta contra el backend, la base y la cadena reales |

Los tests requieren Node 24 o superior y Node ejecutado con `--experimental-vm-modules` (ya configurado en los scripts
`test`/`test:e2e`) porque las dependencias de `@nestjs/*` en el stack aprobado se resuelven como
ESM y Jest 30 solo puede `require()` ESM de forma sincrona con esa flag activa.
