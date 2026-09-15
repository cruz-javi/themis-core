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
desarrollo local — nunca usar en un entorno real.** No existe endpoint de auto-registro: estas son
las únicas cuentas hasta que el equipo agregue una gestión de usuarios.

| Email | Contraseña | Rol |
|---|---|---|
| `admin@themis.dev` | `123123` | `ADMIN` |
| `autoridad@themis.dev` | `123123` | `AUTORIDAD_REGISTRO` |
| `auditor@themis.dev` | `123123` | `AUDITOR` |

## Variables de entorno

Reutiliza `JWT_SECRET` (ya presente en `.env.example` desde el bootstrap, anotado ahí mismo como
"firma de tokens de autoridades"). No agrega variables nuevas.

## Rutas

| Método | Path | Protección | Respuesta |
|---|---|---|---|
| `POST /auth/login` | — | Sin guard (otorga la sesión) | `{ role, nombreCompleto }` + `Set-Cookie: access_token` |
| `GET /auth/me` | — | `JwtAuthGuard` (cookie `access_token`) | `{ sub, role, nombreCompleto }` |
| `POST /auth/logout` | — | Sin guard | `{ ok: true }` + limpia la cookie |

**La sesión viaja en una cookie `httpOnly`, no en un header `Authorization`.** `JwtStrategy` lee
el JWT de `req.cookies.access_token` (vía `cookie-parser`, registrado en `main.ts`) — nunca de
`Authorization: Bearer`. El body de `login`/`me` no incluye el token: el cliente no tiene ni
necesita acceso a él.

`src/shared/auth/` (transversal, fuera de este módulo) expone `JwtAuthGuard`, `RolesGuard` y
`@Roles(...)` para que cualquier módulo futuro (`elections/`, `registration/`, etc.) proteja sus
propios endpoints sin reimplementar la verificación de JWT.
