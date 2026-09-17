/**
 * Prueba manual end-to-end de TODO lo implementado hasta ahora del diagrama de secuencia
 * de votacion: FASE 1 (registro, CU-05) + el bloque de checkpoint (CU-06 a CU-09).
 *
 * No prueba FASE 2 (emision de voto, CU-10) porque no existe ningun endpoint de voto
 * todavia -- el contrato on-chain sigue siendo scaffolding y la insercion CU-09 usa un
 * stub (ver themis-core/docs/checkpoint-lote-multisig.md).
 *
 * Requisitos antes de correr:
 *   - Los 3 procesos de siempre corriendo: pnpm chain:node / chain:deploy:local / start:dev
 *   - pnpm run seed:platform-users corrido al menos una vez (admin@themis.dev /
 *     superusuario@themis.dev con password 123123)
 *
 * Uso: pnpm run test:manual-flow
 *
 * Este script habla HTTP con el backend real (no usa supertest ni levanta un
 * TestingModule) -- es el mismo camino que seguiria themis-app/themis-web, y ejercita el
 * cron real de cierre de checkpoint (espera hasta ~70s a que el tick de EVERY_MINUTE lo
 * cierre solo, no lo dispara a mano).
 */
import { webcrypto } from 'node:crypto';
import { RSABSSA } from '@cloudflare/blindrsa-ts';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/modules/mock-sso/infrastructure/hash.util';

const BASE_URL = 'http://localhost:3000/api/v1';
const RUN_ID = Date.now();

const prisma = new PrismaClient();

function extractCookie(response: Response): string {
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) {
    throw new Error(`Respuesta sin Set-Cookie (status ${response.status})`);
  }
  return setCookie.split(';')[0];
}

async function postJson(
  path: string,
  body: unknown,
  cookie?: string,
): Promise<{ status: number; body: any; cookie?: string }> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (response.status >= 400) {
    console.error(`  ! POST ${path} -> ${response.status}`, json);
  }
  return { status: response.status, body: json, cookie: response.headers.get('set-cookie') ?? undefined };
}

async function getJson(path: string, cookie?: string): Promise<{ status: number; body: any }> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, body: json };
}

async function putJson(path: string, body: unknown, cookie: string): Promise<{ status: number; body: any }> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, body: json };
}

async function login(email: string, password: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (response.status !== 200) {
    throw new Error(`Login fallo para ${email}: ${response.status}`);
  }
  return extractCookie(response);
}

async function blindCommitment(commitment: string) {
  const publicKeyResponse = await getJson('/registration/public-key');
  const suite = RSABSSA.SHA384.PSS.Randomized();
  const publicKey = await webcrypto.subtle.importKey(
    'jwk',
    JSON.parse(publicKeyResponse.body.publicKeyJwk),
    { name: 'RSA-PSS', hash: 'SHA-384' },
    true,
    ['verify'],
  );
  const preparedMsg = suite.prepare(new TextEncoder().encode(commitment));
  const { blindedMsg, inv } = await suite.blind(publicKey, preparedMsg);
  return {
    suite,
    publicKey,
    preparedMsg,
    inv,
    blindedMessage: Buffer.from(blindedMsg).toString('base64'),
  };
}

async function registerVoter(electionId: string, codigoInstitucional: string, commitment: string) {
  const loginResponse = await postJson('/mock-sso/login', { codigoInstitucional, password: '123123' });
  const assertion = loginResponse.body.assertion as string;

  const { suite, publicKey, preparedMsg, inv, blindedMessage } = await blindCommitment(commitment);

  const registerResponse = await postJson(`/elections/${electionId}/registration-requests`, {
    assertion,
    blindedMessage,
  });
  if (registerResponse.status !== 201) {
    throw new Error(`registration-requests fallo para ${codigoInstitucional}`);
  }

  const signature = await suite.finalize(
    publicKey,
    preparedMsg,
    Buffer.from(registerResponse.body.blindSignature, 'base64'),
    inv,
  );

  const presentResponse = await postJson(`/elections/${electionId}/credentials/present`, {
    preparedMessage: Buffer.from(preparedMsg).toString('base64'),
    signature: Buffer.from(signature).toString('base64'),
  });
  if (presentResponse.status !== 201) {
    throw new Error(`credentials/present fallo para ${codigoInstitucional}`);
  }
  console.log(`  - ${codigoInstitucional}: registrado y credencial presentada (commitment=${commitment})`);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('=== FASE 0: setup (SSO de prueba + cuentas de autoridad + eleccion) ===');

  // --- 3 votantes de prueba (mock-sso), habilitados ---
  const voterCodes = [`${RUN_ID}01`, `${RUN_ID}02`, `${RUN_ID}03`].map((c) => c.slice(-9));
  for (const codigo of voterCodes) {
    await prisma.mockSsoUser.upsert({
      where: { codigoInstitucional: codigo },
      update: {},
      create: {
        codigoInstitucional: codigo,
        passwordHash: hashPassword('123123'),
        nombreCompleto: `Votante Flujo ${codigo}`,
        facultad: 'FICCT',
        carrera: 'INGENIERIA_SISTEMAS',
        tipoUsuario: 'ESTUDIANTE',
        estadoAcademico: 'ACTIVO',
      },
    });
  }
  console.log(`3 votantes de prueba listos: ${voterCodes.join(', ')} (password 123123)`);

  // --- 5 cuentas AUTORIDAD_REGISTRO frescas, via SUPERUSUARIO ---
  const superCookie = await login('superusuario@themis.dev', '123123');
  const authorityAccounts: { id: string; email: string }[] = [];
  for (let i = 1; i <= 5; i += 1) {
    const email = `flujo-autoridad-${RUN_ID}-${i}@themis.dev`;
    const created = await postJson(
      '/auth/users',
      { email, password: 'Flujo123!', nombreCompleto: `Autoridad Flujo ${i}`, role: 'AUTORIDAD_REGISTRO' },
      superCookie,
    );
    authorityAccounts.push({ id: created.body.id, email });
  }
  console.log(`5 cuentas AUTORIDAD_REGISTRO creadas (password Flujo123!)`);

  // --- Eleccion, con ventana de registro ya abierta ---
  const adminCookie = await login('admin@themis.dev', '123123');
  const now = new Date();
  const registroInicio = new Date(now.getTime() - 24 * 60 * 60_000);
  const registroFin = new Date(now.getTime() + 24 * 60 * 60_000);
  const votacionInicio = new Date(now.getTime() + 48 * 60 * 60_000);
  const votacionFin = new Date(now.getTime() + 72 * 60 * 60_000);

  const electionResponse = await postJson(
    '/elections',
    {
      nombre: `Flujo completo ${RUN_ID}`,
      registroInicio: registroInicio.toISOString(),
      registroFin: registroFin.toISOString(),
      votacionInicio: votacionInicio.toISOString(),
      votacionFin: votacionFin.toISOString(),
      opciones: [{ nombre: 'Candidato A' }, { nombre: 'Candidato B' }],
    },
    adminCookie,
  );
  const electionId = electionResponse.body.id as string;
  console.log(`Eleccion creada: ${electionId}`);

  // Checkpoint cada 5 min (el minimo permitido) -- hay que configurarlo ANTES de abrir
  // el registro, la politica queda bloqueada una vez REGISTRO_ABIERTO.
  await putJson(
    `/elections/${electionId}/checkpoint-policy`,
    { checkpointIntervalMinutes: 5, rateLimitThresholdPerMinute: 50 },
    adminCookie,
  );
  console.log('Politica de checkpoint configurada: cada 5 minutos');

  await postJson(
    `/elections/${electionId}/authorities`,
    {
      autoridades: authorityAccounts.map((account) => ({
        platformUserId: account.id,
        rolDescriptivo: 'Autoridad de prueba',
      })),
    },
    adminCookie,
  );
  console.log('5 autoridades designadas');

  // No existe todavia un endpoint publico para abrir el registro de una eleccion (gap
  // preexistente, no de esta HU) -- lo forzamos directo en la base, documentado en
  // themis-core/docs/checkpoint-lote-multisig.md.
  await prisma.election.update({
    where: { id: electionId },
    data: { estado: 'REGISTRO_ABIERTO' },
  });
  console.log('Eleccion pasada a REGISTRO_ABIERTO (directo en BD, sin endpoint todavia)\n');

  console.log('=== FASE 1: registro de votantes (CU-05) ===');
  for (let i = 0; i < voterCodes.length; i += 1) {
    await registerVoter(electionId, voterCodes[i], `commitment-flujo-${RUN_ID}-${i}`);
  }

  console.log('\n=== CHECKPOINT: esperando a que el cron cierre el lote (CU-07, hasta ~70s) ===');
  let batchId: string | null = null;
  for (let attempt = 0; attempt < 14; attempt += 1) {
    await sleep(5000);
    const batches = await getJson(`/elections/${electionId}/batches`, adminCookie);
    if (batches.body.length > 0) {
      batchId = batches.body[0].id;
      console.log(`Lote cerrado por el cron: ${batchId} (${batches.body[0].credentialCount} credenciales)`);
      break;
    }
    console.log(`  ... todavia no cierra (intento ${attempt + 1}/14)`);
  }
  if (!batchId) {
    throw new Error('El cron no cerro ningun lote en el tiempo esperado');
  }

  console.log('\n=== CHECKPOINT: aprobacion multisig 3-de-5 (CU-08) ===');
  for (let i = 0; i < 3; i += 1) {
    const cookie = await login(authorityAccounts[i].email, 'Flujo123!');
    const approveResponse = await postJson(
      `/elections/${electionId}/batches/${batchId}/approvals`,
      {},
      cookie,
    );
    console.log(
      `  Aprobacion ${i + 1}/3 (${authorityAccounts[i].email}) -> status=${approveResponse.body.status}, approvalCount=${approveResponse.body.approvalCount}`,
    );
  }

  console.log('\n=== CHECKPOINT: resultado final (CU-09, insercion on-chain simulada) ===');
  const detail = await getJson(`/elections/${electionId}/batches/${batchId}`, adminCookie);
  console.log(JSON.stringify(detail.body, null, 2));

  console.log('\n=== FASE 2 (emision de voto, CU-10): NO IMPLEMENTADA ===');
  console.log(
    'No existe ningun endpoint de voto todavia -- el contrato on-chain sigue siendo scaffolding.\n' +
      'Esta fase del diagrama no se puede probar hasta que se implemente CU-10.',
  );

  console.log(`\nEleccion de prueba: ${electionId} (no se borra automaticamente, queda en la BD).`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
