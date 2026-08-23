import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { isIP } from 'node:net';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const PRODUCTION_PROJECT_REF = 'jfcsbwdawvsxnmovwlgl';
const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/;
const API_ROOT = 'https://api.supabase.com/v1';
const ALLOWED_SECURITY_INFO = new Set([
  'rls_enabled_no_policy:public.api_idempotency_keys',
  'rls_enabled_no_policy:public.identity_action_requests',
]);

function required(environment, name, message) {
  const value = environment[name]?.trim();
  if (!value) throw new Error(message);
  return value;
}

function projectRefFromApplicationUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:'
      || url.username
      || url.password
      || url.port
      || url.pathname !== '/'
      || url.search
      || url.hash
    ) {
      return null;
    }
    return url.hostname.match(/^([a-z0-9]{20})\.supabase\.co$/)?.[1] ?? null;
  } catch {
    return null;
  }
}

function isPublishableKey(value, projectRef) {
  const key = value?.trim();
  if (!key) return false;
  if (/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(key)) return true;
  const parts = key.split('.');
  if (parts.length !== 3 || parts.some((part) => !part)) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return payload?.role === 'anon' && payload.ref === projectRef;
  } catch {
    return false;
  }
}

function targetDatabaseUrl(value, projectRef) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('TARGET_DATABASE_URL must be a valid passwordless PostgreSQL URL.');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.password) {
    throw new Error('TARGET_DATABASE_URL must be a valid passwordless PostgreSQL URL.');
  }
  if (url.pathname !== '/postgres') {
    throw new Error('TARGET_DATABASE_URL must select the dedicated non-production project postgres database.');
  }

  const usernameParts = decodeURIComponent(url.username).split('.');
  const directHost = url.hostname === `db.${projectRef}.supabase.co`;
  const poolerHost = url.hostname.endsWith('.pooler.supabase.com')
    && usernameParts.includes(projectRef);
  if (!directHost && !poolerHost) {
    throw new Error('TARGET_DATABASE_URL is not bound to SUPABASE_TARGET_PROJECT_REF.');
  }
  return url.toString();
}

function collection(payload, key) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.[key])) return payload[key];
  if (Array.isArray(payload?.result?.[key])) return payload.result[key];
  throw new Error(`Supabase response did not contain ${key}.`);
}

function verifyMigrationHistory(payload) {
  const remoteVersions = collection(payload, 'migrations')
    .map((migration) => migration.version ?? migration.remote)
    .filter((version) => typeof version === 'string');
  const localVersions = readdirSync('supabase/migrations')
    .filter((name) => /^\d{14}_.+\.sql$/.test(name))
    .map((name) => name.slice(0, 14));
  const remote = new Set(remoteVersions);
  const local = new Set(localVersions);
  const missingRemotely = localVersions.filter((version) => !remote.has(version));
  const missingLocally = remoteVersions.filter((version) => !local.has(version));
  if (missingRemotely.length || missingLocally.length) {
    throw new Error('Selected target migration history does not exactly match the repository.');
  }
}

function lintIdentity(lint) {
  const schema = lint?.metadata?.schema;
  const name = lint?.metadata?.name;
  return `${lint?.name}:${schema && name ? `${schema}.${name}` : ''}`;
}

function verifyAdvisors(securityPayload, performancePayload) {
  const securityLints = collection(securityPayload, 'lints');
  const performanceLints = collection(performancePayload, 'lints');
  const blockingSecurity = securityLints.filter((lint) => (
    String(lint.level).toUpperCase() !== 'INFO'
    || !ALLOWED_SECURITY_INFO.has(lintIdentity(lint))
  ));
  const blockingPerformance = performanceLints.filter((lint) => (
    lint.name === 'unindexed_foreign_keys'
    || ['WARN', 'ERROR'].includes(String(lint.level).toUpperCase())
  ));
  if (blockingSecurity.length || blockingPerformance.length) {
    throw new Error(
      `Advisor gate failed (${blockingSecurity.length} security, ${blockingPerformance.length} performance).`,
    );
  }
}

function normalize(value) {
  return value.replaceAll('\r\n', '\n').trimEnd();
}

export async function runProductionReadinessVerification({
  environment = process.env,
  fetchFn = fetch,
  spawn = spawnSync,
  stdout = (message) => process.stdout.write(message),
} = {}) {
  const targetProjectRef = required(
    environment,
    'SUPABASE_TARGET_PROJECT_REF',
    'Set SUPABASE_TARGET_PROJECT_REF to the explicit project ref being verified.',
  );
  if (!PROJECT_REF_PATTERN.test(targetProjectRef)) {
    throw new Error('SUPABASE_TARGET_PROJECT_REF must be a valid project ref.');
  }
  const accessToken = required(
    environment,
    'SUPABASE_ACCESS_TOKEN',
    'SUPABASE_ACCESS_TOKEN is required for read-only migration and advisor checks.',
  );
  const productionReadOnly = targetProjectRef === PRODUCTION_PROJECT_REF;
  if (productionReadOnly && environment.ALLOW_PRODUCTION_READ_ONLY_CHECKS !== '1') {
    throw new Error('Production read-only checks require ALLOW_PRODUCTION_READ_ONLY_CHECKS=1.');
  }
  if (productionReadOnly && environment.TARGET_DATABASE_URL?.trim()) {
    throw new Error('Production refuses the database full gate; collect read-only evidence without TARGET_DATABASE_URL.');
  }

  const commandEnvironment = { ...environment };
  delete commandEnvironment.SUPABASE_ACCESS_TOKEN;
  delete commandEnvironment.SUPABASE_DB_PASSWORD;
  delete commandEnvironment.TARGET_DATABASE_URL;

  function run(command, args, { capture = false, env = commandEnvironment } = {}) {
    const result = spawn(command, args, {
      cwd: process.cwd(),
      encoding: 'utf8',
      env,
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
    if (result.error || result.status !== 0) {
      throw new Error(`${command} command failed.`);
    }
    return typeof result.stdout === 'string' ? result.stdout : '';
  }

  async function managementApi(path) {
    const response = await fetchFn(`${API_ROOT}${path}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      method: 'GET',
    });
    if (!response.ok) {
      throw new Error(`Supabase read-only Management API request failed with HTTP ${response.status}.`);
    }
    return response.json();
  }

  async function remoteEvidence() {
    const [migrations, security, performance] = await Promise.all([
      managementApi(`/projects/${targetProjectRef}/database/migrations`),
      managementApi(`/projects/${targetProjectRef}/advisors/security`),
      managementApi(`/projects/${targetProjectRef}/advisors/performance`),
    ]);
    verifyMigrationHistory(migrations);
    verifyAdvisors(security, performance);
  }

  if (productionReadOnly) {
    await remoteEvidence();
    stdout('Read-only production migration and advisor evidence collected; no deployment approval was granted.\n');
    return;
  }

  if (environment.ALLOW_DESTRUCTIVE_LOCAL_RESET !== '1') {
    throw new Error('The full gate requires ALLOW_DESTRUCTIVE_LOCAL_RESET=1 for its disposable local database.');
  }
  const applicationProjectRef = projectRefFromApplicationUrl(
    environment.NEXT_PUBLIC_SUPABASE_URL,
  );
  if (
    applicationProjectRef !== targetProjectRef
    || !isPublishableKey(
      environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      targetProjectRef,
    )
  ) {
    throw new Error('The full-gate application environment is not bound to the selected rehearsal project.');
  }

  const databaseUrl = targetDatabaseUrl(required(
    environment,
    'TARGET_DATABASE_URL',
    'TARGET_DATABASE_URL is required for the isolated rehearsal full gate.',
  ), targetProjectRef);
  const databasePassword = required(
    environment,
    'SUPABASE_DB_PASSWORD',
    'SUPABASE_DB_PASSWORD is required through protected environment injection.',
  );
  const databaseEnvironment = {
    ...commandEnvironment,
    PGPASSWORD: databasePassword,
    SUPABASE_DB_PASSWORD: databasePassword,
  };
  const identity = run('psql', [
    databaseUrl,
    '-X',
    '-Atqc',
    "select current_database() || '|' || coalesce(current_setting('app.environment', true), '') || '|' || coalesce(inet_server_addr()::text, '')",
  ], { capture: true, env: databaseEnvironment }).trim();
  const [databaseName, environmentMarker, serverAddress, ...unexpected] = identity.split('|');
  if (
    databaseName !== 'postgres'
    || environmentMarker !== 'rehearsal'
    || isIP(serverAddress) === 0
    || unexpected.length > 0
  ) {
    throw new Error('TARGET_DATABASE_URL did not resolve to the marked rehearsal database.');
  }

  let localSupabaseStarted = false;
  try {
    run('pnpm', ['install', '--frozen-lockfile']);
    run('pnpm', ['db:start']);
    localSupabaseStarted = true;
    run('pnpm', ['db:reset']);
    run('pnpm', ['db:test']);
    run('pnpm', ['db:lint']);
    run('pnpm', ['db:types:check']);
    run('pnpm', ['lint']);
    run('pnpm', ['ts-check']);
    run('pnpm', ['test']);
    run('pnpm', ['build']);

    run('pnpm', ['exec', 'supabase', 'test', 'db', '--db-url', databaseUrl], {
      env: databaseEnvironment,
    });
    run('pnpm', [
      'exec', 'supabase', 'db', 'lint', '--db-url', databaseUrl,
      '--level', 'warning', '--fail-on', 'warning',
    ], { env: databaseEnvironment });
    const generatedTypes = run('pnpm', [
      'exec', 'supabase', 'gen', 'types', 'typescript', '--db-url', databaseUrl,
    ], { capture: true, env: databaseEnvironment });
    const committedTypes = readFileSync(resolve('src/db/database.types.ts'), 'utf8');
    if (normalize(generatedTypes) !== normalize(committedTypes)) {
      throw new Error('Generated types for the rehearsal target do not match the repository.');
    }

    await remoteEvidence();
    stdout('Production-readiness verification passed for the isolated rehearsal target.\n');
  } finally {
    if (localSupabaseStarted) {
      run('pnpm', ['exec', 'supabase', 'stop', '--no-backup']);
    }
  }
}

const isMain = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  try {
    await runProductionReadinessVerification();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
