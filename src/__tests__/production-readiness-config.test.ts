import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import { describe, expect, it, vi } from 'vitest';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const scriptPath = resolve(repositoryRoot, 'scripts/verify-production-readiness.mjs');
const productionRef = 'jfcsbwdawvsxnmovwlgl';
const rehearsalRef = 'abcdefghijklmnopqrst';

function run(environment: Record<string, string>) {
  return spawnSync(process.execPath, [scriptPath], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: { PATH: process.env.PATH, ...environment },
  });
}

describe('production-readiness verifier', () => {
  it('requires an explicit target and refuses production by default', () => {
    expect(run({}).status).not.toBe(0);
    const production = run({
      SUPABASE_ACCESS_TOKEN: 'never-print-this-token',
      SUPABASE_TARGET_PROJECT_REF: productionRef,
    });
    expect(production.status).not.toBe(0);
    expect(`${production.stdout}${production.stderr}`).not.toContain('never-print-this-token');
  });

  it('uses only read-only Management API endpoints for remote evidence', () => {
    const source = readFileSync(scriptPath, 'utf8');

    expect(source).toContain("method: 'GET'");
    expect(source).toContain('/database/migrations');
    expect(source).toContain('/advisors/security');
    expect(source).toContain('/advisors/performance');
    expect(source).not.toMatch(/method:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/);
    expect(source).not.toMatch(/apply_migration|db:push|migration\s+(?:up|repair)/);
    expect(source).toContain('delete commandEnvironment.SUPABASE_ACCESS_TOKEN');
  });

  it('runs the full rehearsal gate against one bound database and uses executable cleanup argv', async () => {
    const calls: Array<{ command: string; args: string[]; environment: NodeJS.ProcessEnv }> = [];
    const committedTypes = readFileSync(resolve(repositoryRoot, 'src/db/database.types.ts'), 'utf8');
    const spawn = vi.fn((command: string, args: string[], options: { env: NodeJS.ProcessEnv }) => {
      calls.push({ command, args, environment: options.env });
      if (command === 'psql') {
        return { status: 0, stdout: 'postgres|rehearsal|192.0.2.10\n', stderr: '' };
      }
      if (args.includes('gen') && args.includes('types') && args.includes('--db-url')) {
        return { status: 0, stdout: committedTypes, stderr: '' };
      }
      return { status: 0, stdout: '', stderr: '' };
    });
    const migrations = readdirSync(resolve(repositoryRoot, 'supabase/migrations'))
      .filter((name) => /^\d{14}_.+\.sql$/.test(name))
      .map((name) => ({ version: name.slice(0, 14) }));
    const fetchFn = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      const body = url.endsWith('/database/migrations')
        ? migrations
        : { lints: [] };
      return new Response(JSON.stringify(body), { status: 200 });
    });
    const output: string[] = [];
    const { runProductionReadinessVerification } = await import('../../scripts/verify-production-readiness.mjs');
    const targetUrl = `postgresql://postgres.${rehearsalRef}@aws-0-region.pooler.supabase.com:6543/postgres`;

    await runProductionReadinessVerification({
      environment: {
        PATH: process.env.PATH,
        ALLOW_DESTRUCTIVE_LOCAL_RESET: '1',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: `sb_publishable_${'a'.repeat(24)}`,
        NEXT_PUBLIC_SUPABASE_URL: `https://${rehearsalRef}.supabase.co`,
        SUPABASE_ACCESS_TOKEN: 'management-token-sentinel',
        SUPABASE_DB_PASSWORD: 'database-password-sentinel',
        SUPABASE_TARGET_PROJECT_REF: rehearsalRef,
        TARGET_DATABASE_URL: targetUrl,
      },
      fetchFn,
      spawn,
      stdout: (message: string) => output.push(message),
    });

    expect(calls).toContainEqual(expect.objectContaining({
      command: 'pnpm',
      args: ['exec', 'supabase', 'stop', '--no-backup'],
    }));
    expect(calls.some((call) => call.args.includes('--'))).toBe(false);
    for (const expected of [
      ['test', 'db', '--db-url', targetUrl],
      ['db', 'lint', '--db-url', targetUrl, '--level', 'warning', '--fail-on', 'warning'],
      ['gen', 'types', 'typescript', '--db-url', targetUrl],
    ]) {
      expect(calls).toContainEqual(expect.objectContaining({
        command: 'pnpm',
        args: ['exec', 'supabase', ...expected],
      }));
    }
    const identity = calls.find((call) => call.command === 'psql');
    expect(identity?.args[0]).toBe(targetUrl);
    expect(identity?.environment.PGPASSWORD).toBe('database-password-sentinel');
    expect(identity?.environment.SUPABASE_DB_PASSWORD).toBe('database-password-sentinel');
    expect(identity?.environment.SUPABASE_ACCESS_TOKEN).toBeUndefined();
    expect(output.join('')).not.toContain('database-password-sentinel');
  });

  it('keeps production evidence read-only and never calls it a readiness pass', async () => {
    const spawn = vi.fn();
    const migrations = readdirSync(resolve(repositoryRoot, 'supabase/migrations'))
      .filter((name) => /^\d{14}_.+\.sql$/.test(name))
      .map((name) => ({ version: name.slice(0, 14) }));
    const fetchFn = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      const body = url.endsWith('/database/migrations') ? migrations : { lints: [] };
      return new Response(JSON.stringify(body), { status: 200 });
    });
    const output: string[] = [];
    const { runProductionReadinessVerification } = await import('../../scripts/verify-production-readiness.mjs');

    await runProductionReadinessVerification({
      environment: {
        ALLOW_PRODUCTION_READ_ONLY_CHECKS: '1',
        SUPABASE_ACCESS_TOKEN: 'management-token-sentinel',
        SUPABASE_TARGET_PROJECT_REF: productionRef,
      },
      fetchFn,
      spawn,
      stdout: (message: string) => output.push(message),
    });

    expect(spawn).not.toHaveBeenCalled();
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(output.join('')).toContain('Read-only production migration and advisor evidence collected');
    expect(output.join('')).not.toMatch(/readiness.*pass|passed.*readiness/i);
  });

  it('rejects a full gate whose database URL is not bound to the selected project', async () => {
    const spawn = vi.fn();
    const fetchFn = vi.fn();
    const { runProductionReadinessVerification } = await import('../../scripts/verify-production-readiness.mjs');

    await expect(runProductionReadinessVerification({
      environment: {
        ALLOW_DESTRUCTIVE_LOCAL_RESET: '1',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: `sb_publishable_${'a'.repeat(24)}`,
        NEXT_PUBLIC_SUPABASE_URL: `https://${rehearsalRef}.supabase.co`,
        SUPABASE_ACCESS_TOKEN: 'management-token-sentinel',
        SUPABASE_DB_PASSWORD: 'database-password-sentinel',
        SUPABASE_TARGET_PROJECT_REF: rehearsalRef,
        TARGET_DATABASE_URL: 'postgresql://postgres.wrongprojectref0000@aws-0-region.pooler.supabase.com:6543/postgres',
      },
      fetchFn,
      spawn,
    })).rejects.toThrow('bound');

    expect(spawn).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('binds the full-gate application build to the selected rehearsal project', async () => {
    const spawn = vi.fn();
    const fetchFn = vi.fn();
    const { runProductionReadinessVerification } = await import('../../scripts/verify-production-readiness.mjs');

    await expect(runProductionReadinessVerification({
      environment: {
        ALLOW_DESTRUCTIVE_LOCAL_RESET: '1',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: `sb_publishable_${'a'.repeat(24)}`,
        NEXT_PUBLIC_SUPABASE_URL: `https://${productionRef}.supabase.co`,
        SUPABASE_ACCESS_TOKEN: 'management-token-sentinel',
        SUPABASE_DB_PASSWORD: 'database-password-sentinel',
        SUPABASE_TARGET_PROJECT_REF: rehearsalRef,
        TARGET_DATABASE_URL: `postgresql://postgres.${rehearsalRef}@aws-0-region.pooler.supabase.com:6543/postgres`,
      },
      fetchFn,
      spawn,
    })).rejects.toThrow('application environment');

    await expect(runProductionReadinessVerification({
      environment: {
        ALLOW_DESTRUCTIVE_LOCAL_RESET: '1',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
        NEXT_PUBLIC_SUPABASE_URL: `https://${rehearsalRef}.supabase.co`,
        SUPABASE_ACCESS_TOKEN: 'management-token-sentinel',
        SUPABASE_DB_PASSWORD: 'database-password-sentinel',
        SUPABASE_TARGET_PROJECT_REF: rehearsalRef,
        TARGET_DATABASE_URL: `postgresql://postgres.${rehearsalRef}@aws-0-region.pooler.supabase.com:6543/postgres`,
      },
      fetchFn,
      spawn,
    })).rejects.toThrow('application environment');

    expect(spawn).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('refuses the full gate before any command unless destructive local reset is explicit', async () => {
    const spawn = vi.fn();
    const fetchFn = vi.fn();
    const { runProductionReadinessVerification } = await import('../../scripts/verify-production-readiness.mjs');

    await expect(runProductionReadinessVerification({
      environment: {
        SUPABASE_ACCESS_TOKEN: 'management-token-sentinel',
        SUPABASE_DB_PASSWORD: 'database-password-sentinel',
        SUPABASE_TARGET_PROJECT_REF: rehearsalRef,
        TARGET_DATABASE_URL: `postgresql://postgres.${rehearsalRef}@aws-0-region.pooler.supabase.com:6543/postgres`,
      },
      fetchFn,
      spawn,
    })).rejects.toThrow('ALLOW_DESTRUCTIVE_LOCAL_RESET=1');

    expect(spawn).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('refuses a database full gate for the production project', async () => {
    const spawn = vi.fn();
    const fetchFn = vi.fn();
    const { runProductionReadinessVerification } = await import('../../scripts/verify-production-readiness.mjs');

    await expect(runProductionReadinessVerification({
      environment: {
        ALLOW_PRODUCTION_READ_ONLY_CHECKS: '1',
        SUPABASE_ACCESS_TOKEN: 'management-token-sentinel',
        SUPABASE_TARGET_PROJECT_REF: productionRef,
        TARGET_DATABASE_URL: `postgresql://postgres.${productionRef}@aws-0-region.pooler.supabase.com:6543/postgres`,
      },
      fetchFn,
      spawn,
    })).rejects.toThrow('refuses the database full gate');

    expect(spawn).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
