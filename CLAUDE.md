# Themis — contexto del workspace

Sistema de votación electoral con blockchain (Semaphore, zk-SNARKs). Proyecto de tesis/curso ("Ingeniería de Software 2"), elección piloto: Representante FICCT.

**Antes que nada, leer [`docs/diseno-consolidado.md`](docs/diseno-consolidado.md)** — es la fuente de verdad del diseño: arquitectura, los 15 casos de uso, modelo de base de datos, y las decisiones de diseño abiertas (mobile-only, riesgo de pérdida de identidad, propuesta de frase mnemónica). [`docs/vision-futuro.md`](docs/vision-futuro.md) tiene ideas de producto a más largo plazo que **no** son el alcance actual — no mezclar las dos cosas.

## Las dos reglas que gobiernan todo el diseño

1. El endpoint de registro va autenticado; el de voto no (si votar exigiera sesión, se podría correlacionar votante con voto).
2. Ninguna tabla de la base de datos permite reconstruir la relación entre identidad real y credencial de votación.

Cualquier cambio de arquitectura en cualquiera de los 4 repos debe respetar estas dos reglas.

## Los 4 repos (cada uno con su propio CLAUDE.md con detalle específico)

| Repo          | Rol                                                                                          | CLAUDE.md                                                                 |
| ------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `themis-core` | Backend NestJS + contratos Solidity/Hardhat + Prisma                                         | [themis-core/CLAUDE.md](themis-core/CLAUDE.md)                            |
| `themis-web`  | Portal admin (Vite/React) + código de pruebas ZK (`/prove`, consumido por WebView de la app) | [themis-web/CLAUDE.md](themis-web/CLAUDE.md)                              |
| `themis-app`  | App móvil del votante (Flutter) — registro y voto ocurren **exclusivamente aquí**            | [themis-app/CLAUDE.md](themis-app/CLAUDE.md)                              |
| `themis-ai`   | Microservicio de proyección de resultados (Python/FastAPI), sin acceso a BD                  | [themis-ai/CLAUDE.md](themis-ai/CLAUDE.md) — **todavía no en uso activo** |

Dato clave que atraviesa los 4: `themis-app` no reimplementa la criptografía ZK en Dart — abre un WebView interno contra `/prove` de `themis-web` y recibe la prueba por `postMessage`. Un usuario que entra a `themis-web` desde el navegador normal no tiene forma de votar; esa ruta solo la carga la app.

## Levantar todo

`themis.code-workspace` (multi-root, abrir con "Open Workspace from File") trae tareas de VS Code:

- `Ctrl+Shift+B` → **"🚀 Levantar core + web"** (default): chain Hardhat + backend NestJS + frontend Vite en paralelo, 3 terminales dedicados. No incluye `themis-ai` (no en uso todavía) — para eso existe la tarea separada "🚀 Levantar todo (ai + core + web)".
- Antes de la primera vez: Postgres local vía `docker compose -f themis-core/docker-compose.yml up -d db`, luego `pnpm prisma:migrate` en `themis-core`, luego `pnpm chain:deploy:local` (una vez por cada arranque del nodo Hardhat desde cero — copiar la address impresa a `CONTRACT_ADDRESS` en `themis-core/.env`).

**Trampa conocida (Windows):** si tienes varias versiones de Postgres instaladas como servicios de Windows, van a ocupar 5432/5433/5434... antes que el contenedor Docker. Verificar con `Get-NetTCPConnection -LocalPort <puerto>` + `Get-Process -Id <pid>` antes de asumir que las credenciales del `.env` están mal.

## Variables de entorno compartidas entre repos

`SERVICE_TOKEN` (themis-ai) debe ser igual a `AI_SERVICE_TOKEN` (themis-core). El resto de secretos (`JWT_SECRET`, `SSO_MOCK_SECRET`, `RELAYER_PRIVATE_KEY`) son locales a themis-core, sin necesidad de coincidir con nada externo. Ningún repo commitea su `.env` (todos están en `.gitignore`, incluido `themis-app/assets/.env`).

## Estado actual (para no asumir de más)

- **CU-01 a CU-04** (crear elección, padrón, autoridades, política de checkpoint — todo Admin/Web) implementados en `themis-core` (`src/modules/elections/`) + `themis-web`: formularios, validación, persistencia en Postgres, con tests. Las autoridades son cuentas de plataforma (no claves criptográficas) y el mecanismo/umbral multisig siguen siendo constantes fijas de código, no columnas configurables. Ver `docs/modelo-bd-registro.md` para el detalle de qué es constante vs. columna.
- **Ciclo de vida de la elección automático por fechas**: un cron mueve `estado` (BORRADOR → REGISTRO_ABIERTO → REGISTRO_CERRADO → VOTACION_ABIERTA → CERRADA); abrir el registro exige padrón configurado y las 5 autoridades. No hay endpoint para abrirlo a mano. Ver `docs/ciclo-de-vida-elecciones.md`.
- **CU-05** (registro del votante) implementado de punta a punta, incluyendo la criptografía real: `themis-app` genera la identidad Semaphore y ciega el commitment (RSA blind signature, RFC 9474, vía `@cloudflare/blindrsa-ts` corriendo en un WebView local — no reimplementado en Dart), `themis-core` (`src/modules/registration/`) lo firma ciegamente sin verlo nunca en claro, y un segundo endpoint anónimo (`POST /elections/:id/credentials/present`) recibe la credencial certificada tiempo después, sin ninguna conexión con el registro original. Validado end-to-end en dispositivo físico. Ver `themis-core/src/modules/registration/README.md` para el protocolo completo, incluida la mitigación (parcial, no resuelta del todo) de correlación por timing.
- **CU-06 a CU-09** (alertas de ritmo, cierre de checkpoint por cron, aprobación 3-de-5 de lotes, inserción en el árbol on-chain) implementados de punta a punta en `src/modules/checkpoints/`, con pantalla de aprobación en `themis-web` (`features/batch-approval/`). La inserción es **real**: `contracts/ThemisSemaphoreRegistry.sol` (wrapper del Semaphore v4 oficial), un grupo por elección. El multisig son 3 filas en BD, no firmas verificadas on-chain. Ver `docs/README.md` (índice), `docs/checkpoint-lote-multisig.md`, `docs/insercion-onchain-semaphore.md` y `docs/guia-prueba-end-to-end.md`.
- **CU-10 en adelante** (voto, conteo, auditoría) **no implementado** — es la Fase 2. `ThemisRegistry.sol` sigue siendo solo andamiaje. Lo pendiente y por qué está en la sección "Pendiente para la Fase 2" de `docs/checkpoint-lote-multisig.md`.
- La ruta `/prove` de themis-web sigue sin existir. El cliente OpenAPI generado en `themis-app/lib/data/api/` sigue vacío (los repos HTTP de la app están escritos a mano).
