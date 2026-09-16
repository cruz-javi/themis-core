# auth

Autenticación de Administrador y Autoridades (HU00_1, `docs/HU/HU00_1.md`). Sesión real y
permanente para las personas del equipo/institución que operan el portal administrativo —
**no confundir con `mock-sso/`** (HU-00), que simula el SSO institucional del votante y es un
sistema completamente independiente.

## Contrato

El payload de sesión verificado (el JWT ya decodificado, no el token opaco) está fijado en
[`platform-session.contract.json`](./platform-session.contract.json).

## Credenciales de prueba (seed)

Sembradas por `pnpm run seed:platform-users` (`prisma/seed-platform-users.ts`). **Solo para
desarrollo local — nunca usar en un entorno real.** No existe endpoint de auto-registro (`POST
/auth/register` responde 404 a propósito): la única cuenta que se crea por seed es la de
`SUPERUSUARIO` — el resto (`ADMIN`/`AUTORIDAD_REGISTRO`/`AUDITOR`) se crea desde ahí, vía `POST
/auth/users`.

| Email | Contraseña | Rol |
|---|---|---|
| `admin@themis.dev` | `123123` | `ADMIN` |
| `autoridad@themis.dev` | `123123` | `AUTORIDAD_REGISTRO` |
| `auditor@themis.dev` | `123123` | `AUDITOR` |
| `superusuario@themis.dev` | `123123` | `SUPERUSUARIO` |

## Variables de entorno

Reutiliza `JWT_SECRET` (ya presente en `.env.example` desde el bootstrap, anotado ahí mismo como
"firma de tokens de autoridades"). No agrega variables nuevas.

## Rutas

| Método | Path | Protección | Respuesta |
|---|---|---|---|
| `POST /auth/login` | — | Sin guard (otorga la sesión) | `{ role, nombreCompleto }` + `Set-Cookie: access_token` |
| `GET /auth/me` | — | `JwtAuthGuard` (cookie `access_token`) | `{ sub, role, nombreCompleto }` |
| `POST /auth/logout` | — | Sin guard | `{ ok: true }` + limpia la cookie |
| `POST /auth/users` | Crea una cuenta `ADMIN`/`AUTORIDAD_REGISTRO`/`AUDITOR` | `JwtAuthGuard` + `RolesGuard(SUPERUSUARIO)` | `{ id, email, nombreCompleto, role, isActive, createdAt }` (201); `403` si no es SUPERUSUARIO; `409` si el email ya existe; `400` si `role` es `SUPERUSUARIO` |
| `GET /auth/users?page=&pageSize=` | Lista paginada de cuentas **activas** | `JwtAuthGuard` + `RolesGuard(SUPERUSUARIO)` | `{ data: [...], total, page, pageSize }`; `page` desde 1, `pageSize` 1-100 (default 20) |
| `PATCH /auth/users/:id` | Edita `nombreCompleto`/`role` (`ADMIN`/`AUTORIDAD_REGISTRO`/`AUDITOR`) | `JwtAuthGuard` + `RolesGuard(SUPERUSUARIO)` | `{ id, email, nombreCompleto, role, isActive, createdAt }`; `404` si no existe, ya está desactivada, o es SUPERUSUARIO |
| `DELETE /auth/users/:id` | Desactiva la cuenta (soft-delete, `isActive = false`) | `JwtAuthGuard` + `RolesGuard(SUPERUSUARIO)` | `{ ok: true }`; `404` si no existe, ya está desactivada, o es SUPERUSUARIO |

`POST /auth/users` es el primer consumidor real de `RolesGuard`/`@Roles(...)` en el codebase — el
orden de los guards importa: `JwtAuthGuard` primero (puebla `request.user` desde la cookie),
`RolesGuard` después (lee `request.user.role`). `SUPERUSUARIO` no es creable, editable ni
desactivable por ninguna de estas rutas — la única cuenta de ese rol es la sembrada por el seed.

**Soft-delete, no borrado físico.** `PlatformUser.isActive` (default `true`) es la única columna
de estado — no hay `deletedAt`. Una cuenta desactivada: no aparece en `GET /auth/users`, no puede
loguearse (`POST /auth/login` responde el mismo `AUTH_INVALID_CREDENTIALS` genérico, sin revelar
que la cuenta existe pero está deshabilitada) y, si ya tenía una sesión JWT vigente, esa sesión
deja de resolver en `GET /auth/me` (`AUTH_SESSION_EXPIRED`).

**Paginación**: `GET /auth/users` es el primer endpoint paginado del backend — no había una
convención previa que seguir (ver `docs/HU`/UT si se agrega otra lista paginada, debería reusar
esta misma forma: query `page`/`pageSize`, respuesta `{ data, total, page, pageSize }`).

**La sesión viaja en una cookie `httpOnly`, no en un header `Authorization`.** `JwtStrategy` lee
el JWT de `req.cookies.access_token` (vía `cookie-parser`, registrado en `main.ts`) — nunca de
`Authorization: Bearer`. El body de `login`/`me` no incluye el token: el cliente no tiene ni
necesita acceso a él.

`src/shared/auth/` (transversal, fuera de este módulo) expone `JwtAuthGuard`, `RolesGuard` y
`@Roles(...)` para que cualquier módulo futuro (`elections/`, `registration/`, etc.) proteja sus
propios endpoints sin reimplementar la verificación de JWT.
