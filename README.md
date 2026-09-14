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

# 2 - desplegar el contrato (una vez por arranque del nodo)
pnpm chain:deploy:local
# copia la direccion que imprime en CONTRACT_ADDRESS del .env

# 3 - el backend
pnpm start:dev
```

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
```

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
| `pnpm prisma:migrate` | Crea y aplica una migracion |
| `pnpm prisma:studio` | Explorador visual de la base de datos |
| `pnpm chain:node` | Nodo blockchain local |
| `pnpm chain:compile` | Compila los contratos |
| `pnpm chain:deploy:local` | Despliega en el nodo local |
