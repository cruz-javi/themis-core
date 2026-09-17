# Checkpoint — inserción por lote con multisig (CU-06 a CU-09)

> Estado: backend implementado y verificado contra Neon (real DB, no solo mocks). La integración
> on-chain real (Semaphore) y la pantalla de aprobación en `themis-web` **todavía no están hechas**
> — ver "Qué falta" abajo. Plan completo de la HU: ver el diagrama de secuencia del bloque
> "Checkpoint — inserción por lote con multisig" y `docs/docs/modelo-bd-registro.md` (a nivel
> workspace) para el diseño de datos de referencia.

## Por qué todavía no se puede ver el flujo completo desde una UI

Ninguna de las dos apps con UI cubre hoy las dos puntas del flujo:

- **El registro (CU-05, FASE 1 del diagrama) es exclusivamente de `themis-app`** (regla de diseño
  del proyecto, no un olvido — `themis-web` nunca debe ser una vía de registro/voto). `themis-app`
  está fuera del alcance de este trabajo, así que aunque el backend ya soporta el protocolo de firma
  ciega completo, **no hay ninguna pantalla, ni en `themis-web` ni en ningún lado tocado por esta
  HU, para generarlo** — solo se puede ejercitar hablando HTTP directo con `themis-core`.
- **La aprobación de lotes (CU-08) no tiene pantalla en `themis-web` todavía** — es la Fase 7 del
  plan original, no implementada. `themis-web` sí tiene ya la parte de Admin (crear elección,
  configurar padrón/checkpoint, designar autoridades), pero no la parte de Autoridad.

Es decir: para ver el ciclo completo **desde una interfaz gráfica**, hacen falta dos cosas que no
están hechas — el flujo de registro de `themis-app`, y la pantalla de aprobación de `themis-web`.
Hasta que exista al menos una de las dos, la única forma de ejercitar el backend es hablando con la
API directamente (`curl`, Swagger en `/docs`, o el script de prueba — ver "Cómo probarlo
manualmente"). El estado real del backend (probado, funcionando) no depende de esto — es una
limitación de *cómo observarlo*, no de si funciona.

## Qué cubre

| CU | Descripción | Estado |
|---|---|---|
| CU-06 | Monitorear ritmo de registro (alertas) | Implementado |
| CU-07 | Cerrar checkpoint y proponer lote | Implementado (cron automático) |
| CU-08 | Aprobar lote de registros (multisig 3-de-5) | Implementado (backend) |
| CU-09 | Insertar lote en el árbol de Merkle on-chain | Backend listo, detrás de un **stub** — falta el contrato Solidity real |

## Qué se implementó

### Modelo de datos (`prisma/schema.prisma`)

Tres modelos nuevos:

- **`RegistrationBatch`** (`registration_batches`): un lote cerrado por el cron, con
  `status: PENDING_APPROVAL | APPROVED | INSERTED | INSERTION_FAILED`, `approvalsRequired`
  (congela `MULTISIG_THRESHOLD` al cerrar), y los campos de resultado on-chain
  (`merkleRootAfter`, `onChainTxHash`, `onChainGroupId`).
- **`BatchApproval`** (`batch_approvals`): una fila = una aprobación de una autoridad. El multisig
  3-de-5 se implementa **contando filas** (`@@unique([batchId, authorityId])`), no con una columna
  "aprobado" — coherente con el diseño original del proyecto. `authorityId` referencia el *asiento*
  (`Authority.id`), no la cuenta directamente, para que "la misma autoridad no aprueba dos veces"
  siga siendo correcto aunque se reemplace la cuenta de un asiento a mitad de ciclo.
- **`RateAlert`** (`rate_alerts`): historial de "esto se registró más rápido de lo normal" (CU-06),
  puramente informativo.

Más columnas nuevas en `Election` (`lastCheckpointClosedAt`, `onChainGroupId`,
`onChainGroupCreatedAt`, `merkleRoot`) y en `PresentedCredential` (`batchId`). El lote se arma
siempre sobre `PresentedCredential.commitment` (el commitment real, ya anónimo) — nunca sobre
`RegistrationRequest`, que solo tiene el valor cegado y no tiene forma de vincularse con el
commitment real sin romper el anonimato del votante.

### Módulo `src/modules/checkpoints/`

Módulo nuevo, mismas 4 capas (domain/application/infrastructure/presentation) que el resto del
backend:

- **`CloseCheckpointUseCase` / `CloseDueCheckpointsUseCase`** (CU-07): cierre automático vía cron
  (`@nestjs/schedule`, tick `EVERY_MINUTE` — más fino que el `checkpointIntervalMinutes` mínimo
  configurable de 5 min, para no violar la política de ninguna elección). Evita doble cierre por
  carrera con un compare-and-swap sobre `Election.lastCheckpointClosedAt`
  (`ElectionRepository.tryClaimCheckpoint`).
- **`ApproveBatchUseCase`** (CU-08): una autoridad aprueba un lote. Verifica que la cuenta esté
  designada como autoridad *de esa elección específica* (el `RolesGuard` por sí solo no alcanza,
  solo prueba el rol de la cuenta, no el alcance por elección). La aprobación que cruza
  `approvalsRequired` (la 3ra, hoy) dispara la inserción on-chain **en el mismo request**, protegida
  con otro CAS para que solo se dispare una vez aunque dos aprobaciones lleguen casi simultáneas.
- **`RetryPendingInsertionsUseCase`**: red de seguridad (cron cada 5 min) para lotes que quedaron
  `APPROVED`/`INSERTION_FAILED` si el paso on-chain falló o el proceso murió a mitad de camino. El
  disparador primario sigue siendo `ApproveBatchUseCase`, síncrono.
- **`CheckRegistrationRateUseCase`** (CU-06): por elección con registro abierto, cuenta credenciales
  presentadas en el último minuto contra `rateLimitThresholdEfectivo`; crea `RateAlert` con
  cooldown de 10 min para no saturar de alertas. No bloquea ningún flujo de registro.
- **`SemaphoreOnChainPort`** (`domain/semaphore-onchain.port.ts`): la interfaz que
  `ApproveBatchUseCase`/`RetryPendingInsertionsUseCase` usan para insertar on-chain. Hoy está ligada
  a `StubSemaphoreOnChainService` (`infrastructure/`), que simula la inserción sin tocar ninguna
  blockchain — ver "Qué falta".
- **`ListBatchesUseCase` / `GetBatchDetailUseCase` / `ListRateAlertsUseCase` /
  `ListMyAuthorityElectionsUseCase`**: lecturas para los endpoints REST y para la futura UI web.

### Endpoints (`CheckpointsController`)

| Método | Ruta | Rol |
|---|---|---|
| `GET` | `/elections/mine/authority` | `AUTORIDAD_REGISTRO` (descubre en qué elecciones está designada la cuenta) |
| `GET` | `/elections/:electionId/batches` | `ADMIN`, `AUTORIDAD_REGISTRO`, `AUDITOR` |
| `GET` | `/elections/:electionId/batches/:batchId` | `ADMIN`, `AUTORIDAD_REGISTRO`, `AUDITOR` |
| `POST` | `/elections/:electionId/batches/:batchId/approvals` | `AUTORIDAD_REGISTRO` |
| `GET` | `/elections/:electionId/rate-alerts` | `ADMIN`, `AUDITOR` |

`GET /elections/mine/authority` es un endpoint nuevo fuera del alcance original de CU-06/07/08/09,
pero necesario: `GET /elections/:id/authorities` es `ADMIN`-only, así que sin este endpoint ninguna
autoridad tiene forma de descubrir en qué elecciones fue designada.

### Tests

7 specs nuevos en `src/modules/checkpoints/application/*.spec.ts`, con dobles in-memory nuevos
(`InMemoryRegistrationBatchRepository`, `InMemoryBatchApprovalRepository`,
`InMemoryRateAlertRepository`, `FakeSemaphoreOnChainService` en `test/doubles/`). Cubren: aprobación
parcial, la 3ra aprobación dispara la inserción exactamente una vez (incluso con dos aprobaciones
"3ras" simultáneas), doble aprobación de la misma autoridad, autoridad no designada en esa elección,
lote ya no pendiente, fallo del servicio on-chain, cierre con cero credenciales pendientes, doble
cierre antes de que venza el intervalo.

**Los specs no se pudieron ejecutar en esta sesión** — `pnpm test` está roto en todo el repo (no solo
en lo nuevo): Jest 30 necesita Node ≥24.9 para cargar `@nestjs/common` (ESM-only) vía `require()`, y
la máquina de desarrollo tenía Node 22.23.2. Confirmado con `git stash` corriendo un spec ya
existente, sin ningún cambio de esta HU: falla igual. Se compensó con `tsc --noEmit` (limpio en todo
`src/` + `test/`) y un smoke test manual end-to-end contra Neon real (crear elección → 5 autoridades
→ credencial presentada → cerrar checkpoint → 3 aprobaciones → inserción simulada → verificar que
`PresentedCredential.status` e `Election.merkleRoot` quedan correctos). **Antes de confiar en los
specs, resolver el desajuste Jest/Node** (subir Node a ≥24.9, o bajar la versión de Jest/­
`@nestjs/common` — decisión del equipo, no tomada acá).

## Qué falta

Próximos pasos, para quien retome esto:

1. **Pantalla de aprobación en `themis-web`** (`features/batch-approval/`) — es lo que más directamente
   desbloquea poder *ver* este bloque funcionando desde una UI (no depende de `themis-app` ni de
   Semaphore real). Lista de lotes pendientes, detalle con progreso "X de 3", botón Aprobar. Diseño
   ya detallado en `themis-web/docs/checkpoint-lote-multisig.md`.
2. **Contrato Solidity real** (`ThemisSemaphoreRegistry.sol`, con `@semaphore-protocol/contracts`):
   `StubSemaphoreOnChainService` devuelve un resultado sintético (`stub-root-...`, `0xstub-...`) sin
   tocar ninguna blockchain. Hay que escribir el contrato con Semaphore real, extender
   `scripts/deploy.ts`, ajustar `BlockchainService`, y reemplazar el stub por la implementación real
   en `checkpoints.module.ts` (`SEMAPHORE_ONCHAIN_PORT`).
3. **Arreglar `pnpm test`** en el repo (bloqueante para poder correr los specs nuevos y los
   existentes) — ver el problema Jest/Node documentado arriba.
4. **Ejecutar los specs** una vez resuelto lo anterior, y correr `pnpm test:e2e` si aplica.
5. **Flujo de registro en `themis-app`** — fuera del alcance de este trabajo (repo no tocado), pero
   es la otra pieza que falta para poder ver el diagrama completo de punta a punta sin hablar con la
   API a mano.

## Cómo probarlo manualmente

```bash
# 3 terminales, como siempre: chain:node, chain:deploy:local, start:dev
pnpm chain:node
pnpm chain:deploy:local
pnpm start:dev
```

Con los 3 procesos arriba y `pnpm run seed:platform-users` corrido al menos una vez, un cuarto
terminal:

```bash
pnpm run test:manual-flow
```

`scripts/manual-test-full-flow.ts` ejercita **todo lo implementado del diagrama de secuencia** en un
solo corrida, hablando HTTP real con el backend (el mismo camino que seguiría `themis-app`/
`themis-web`, no un test en proceso): crea 3 votantes de prueba en `mock_sso_users`, 5 cuentas
`AUTORIDAD_REGISTRO`, una elección con la ventana de registro ya abierta, corre el protocolo RFC 9474
completo de firma ciega (`@cloudflare/blindrsa-ts`, la misma librería que usa `themis-app`) para
registrar y presentar las 3 credenciales, **espera a que el cron real cierre el checkpoint solo**
(no lo dispara a mano), aprueba el lote con 3 de las 5 autoridades, y muestra el resultado final
(`INSERTED`, con el root/tx sintéticos del stub). Al final imprime explícitamente que FASE 2 (emitir
voto, CU-10) no tiene ningún endpoint todavía, así que no se puede probar. No borra los datos que
crea — quedan en la base para inspeccionar con `pnpm prisma:studio` (limpiar a mano si hace falta).

## Archivos clave

- `themis-core/prisma/schema.prisma`
- `themis-core/src/modules/checkpoints/checkpoints.module.ts`
- `themis-core/src/modules/checkpoints/application/approve-batch.usecase.ts`
- `themis-core/src/modules/checkpoints/infrastructure/checkpoint.scheduler.ts`
- `themis-core/src/modules/checkpoints/domain/semaphore-onchain.port.ts` (el puerto a reemplazar)
