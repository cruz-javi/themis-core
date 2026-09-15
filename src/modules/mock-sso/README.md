# mock-sso

Simulación del SSO institucional (HU-00, `docs/HU/HU-00.md`). Reemplaza, solo para desarrollo, la
integración real con el sistema de identidad de la universidad, que no está disponible durante el
piloto.

**Este módulo es andamiaje de desarrollo/demo.** El día que exista una integración real con el SSO
institucional, se retira sin tocar el contrato de `scoped_token_hash` (ver "Decisiones de diseño"
en `docs/UT/HU00/UT-CORE/README.md`).

## Contrato

El contenido verificado de una *assertion* está fijado en
[`mock-sso-assertion.contract.json`](./mock-sso-assertion.contract.json). El formato del token en
sí (`base64url(payload).hmacHex`) es un detalle interno de este módulo.

## Credenciales de prueba (seed)

Sembradas por `pnpm run seed:mock-sso` (`prisma/seed-mock-sso.ts`), de forma **dinámica y
programática** (no hay 5000 filas escritas a mano). **Solo para desarrollo local — nunca usar en
un entorno real.**

- **Password única para todos los usuarios sembrados:** `123123`.
- **Código institucional:** siempre 9 caracteres numéricos, asignados secuencialmente dentro del
  rango asignado por el equipo `220999999`–`223999999` (el script lanza un error si algún código
  generado se saliera de ese rango).
- **Volumen:** 5000 usuarios con `tipoUsuario = ESTUDIANTE` (códigos `220999999`–`221004998`) +
  5 usuarios de staff (`221004999`–`221005003`: 3 `DOCENTE`, 2 `ADMINISTRATIVO`) para tener
  variedad de casos "no habilitado por tipo".
- Dentro de los 5000 estudiantes, ~15% tiene `estadoAcademico = INACTIVO` (distribución
  aleatoria) para tener variedad de casos "no habilitado por estado".
- El script es **idempotente**: usa `codigoInstitucional` como clave única
  (`createMany({ skipDuplicates: true })`); correrlo de nuevo no duplica filas.

Casos fijos garantizados (siempre en el mismo código, para pruebas manuales reproducibles):

| Código institucional | Contraseña | Resultado esperado |
|---|---|---|
| `220999999` | `123123` | Habilitado (ESTUDIANTE, ACTIVO, FICCT) |
| `221000000` | `123123` | No habilitado — estado académico inactivo |
| `221004999` | `123123` | No habilitado — es docente, no estudiante |

Cualquier otro código entre `221000001` y `221004998` (contraseña siempre `123123`) es un
estudiante válido con carrera y estado académico aleatorios — útil para probar contra una
población grande sin depender de un único usuario.

## Variables de entorno

| Variable | Para qué sirve |
|---|---|
| `SSO_MOCK_SECRET` | Firma HMAC-SHA256 de la *assertion*. Mismo valor que se reutilizará como `secreto_SSO` en el HMAC de `scoped_token_hash` cuando exista CU-05. |
| `SSO_MOCK_TOKEN_TTL_SECONDS` | Tiempo de vida de la *assertion*, en segundos. |
