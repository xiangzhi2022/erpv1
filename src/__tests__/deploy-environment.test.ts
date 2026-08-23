import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const guardPath = resolve(repositoryRoot, 'scripts/verify-deploy-environment.mjs');
const productionRef = 'jfcsbwdawvsxnmovwlgl';
const stagingRef = 'abcdefghijklmnopqrst';
const publishableKey = `sb_publishable_${'a'.repeat(24)}`;

interface GuardEnvironment {
  APP_URL?: string;
  CONTEXT?: string;
  DEPLOY_PRIME_URL?: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  RATE_LIMIT_PEPPER?: string;
}

function runGuard(environment: GuardEnvironment) {
  return spawnSync(process.execPath, [guardPath], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      CONTEXT: '',
      APP_URL: '',
      DEPLOY_PRIME_URL: '',
      NEXT_PUBLIC_SUPABASE_URL: '',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
      ...environment,
    },
  });
}

describe('Netlify deploy environment guard', () => {
  it.each([
    { environment: {}, scenario: 'ordinary local execution' },
    { environment: { CONTEXT: 'dev' }, scenario: 'Netlify local development' },
  ])('does not require deployment variables during $scenario', ({ environment }) => {
    expect(runGuard(environment).status).toBe(0);
  });

  it('requires production to use the exact production Supabase project origin', () => {
    expect(runGuard({
      APP_URL: 'https://qingya-erp-163.netlify.app',
      CONTEXT: 'production',
      NEXT_PUBLIC_SUPABASE_URL: `https://${productionRef}.supabase.co`,
    }).status).toBe(0);

    for (const url of [
      '',
      `http://${productionRef}.supabase.co`,
      'https://abcdefghijklmnopqrst.supabase.co',
      `https://${productionRef}.supabase.co/rest/v1`,
      `https://${productionRef}.supabase.co?source=preview`,
      `https://${productionRef}.supabase.co.evil.example`,
    ]) {
      expect(runGuard({
        APP_URL: 'https://qingya-erp-163.netlify.app',
        CONTEXT: 'production',
        NEXT_PUBLIC_SUPABASE_URL: url,
      }).status).not.toBe(0);
    }
  });

  it('rejects a missing or incorrect production application origin', () => {
    for (const appUrl of [
      '',
      'http://qingya-erp-163.netlify.app',
      'https://other-site.netlify.app',
      'https://qingya-erp-163.netlify.app/auth/confirm',
    ]) {
      expect(runGuard({
        APP_URL: appUrl,
        CONTEXT: 'production',
        NEXT_PUBLIC_SUPABASE_URL: `https://${productionRef}.supabase.co`,
      }).status).not.toBe(0);
    }
  });

  it.each(['production', 'deploy-preview', 'branch-deploy'])(
    'requires %s to use a non-secret publishable key',
    (context) => {
      const deployEnvironment = context === 'production'
        ? {
          APP_URL: 'https://qingya-erp-163.netlify.app',
          NEXT_PUBLIC_SUPABASE_URL: `https://${productionRef}.supabase.co`,
        }
        : {
          DEPLOY_PRIME_URL: 'https://deploy-preview-42--qingya-erp-163.netlify.app',
          NEXT_PUBLIC_SUPABASE_URL: `https://${stagingRef}.supabase.co`,
        };
      const expectedRef = context === 'production' ? productionRef : stagingRef;
      const jwt = (role: string, ref?: string) => [
        Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
        Buffer.from(JSON.stringify({ role, ...(ref ? { ref } : {}) })).toString('base64url'),
        'signature',
      ].join('.');

      for (const candidate of [
        '',
        'not-a-key',
        `sb_secret_${'b'.repeat(24)}`,
        jwt('service_role', expectedRef),
        jwt('anon'),
        jwt('anon', 'wrongprojectref00000'),
      ]) {
        expect(runGuard({
          CONTEXT: context,
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: candidate,
          ...deployEnvironment,
        }).status).not.toBe(0);
      }

      expect(runGuard({
        CONTEXT: context,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: jwt('anon', expectedRef),
        ...deployEnvironment,
      }).status).toBe(0);
    },
  );

  it.each(['deploy-preview', 'branch-deploy'])(
    'requires %s to use a valid non-production Supabase project origin',
    (context) => {
      expect(runGuard({
        CONTEXT: context,
        DEPLOY_PRIME_URL: 'https://deploy-preview-42--qingya-erp-163.netlify.app',
        NEXT_PUBLIC_SUPABASE_URL: `https://${stagingRef}.supabase.co`,
      }).status).toBe(0);

      for (const url of [
        '',
        'not-a-url',
        `http://${stagingRef}.supabase.co`,
        `https://${productionRef}.supabase.co`,
        'https://preview.example.com',
        `https://${stagingRef}.supabase.co/path`,
      ]) {
        expect(runGuard({
          CONTEXT: context,
          DEPLOY_PRIME_URL: 'https://deploy-preview-42--qingya-erp-163.netlify.app',
          NEXT_PUBLIC_SUPABASE_URL: url,
        }).status).not.toBe(0);
      }
    },
  );

  it.each(['deploy-preview', 'branch-deploy'])(
    'rejects %s when the effective application origin is missing or not the deploy origin',
    (context) => {
      for (const environment of [
        {},
        { DEPLOY_PRIME_URL: 'http://deploy-preview-42--qingya-erp-163.netlify.app' },
        {
          APP_URL: 'https://qingya-erp-163.netlify.app',
          DEPLOY_PRIME_URL: 'https://deploy-preview-42--qingya-erp-163.netlify.app',
        },
      ]) {
        expect(runGuard({
          CONTEXT: context,
          NEXT_PUBLIC_SUPABASE_URL: `https://${stagingRef}.supabase.co`,
          ...environment,
        }).status).not.toBe(0);
      }
    },
  );

  it('never writes environment values to stdout or stderr', () => {
    const sentinel = 'NEVER_PRINT_THIS_VALUE';
    const result = runGuard({
      CONTEXT: 'deploy-preview',
      NEXT_PUBLIC_SUPABASE_URL: `https://${sentinel}.example.com`,
      SUPABASE_SECRET_KEY: sentinel,
      RATE_LIMIT_PEPPER: sentinel,
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).not.toContain(sentinel);
  });
});

describe('application origin resolution', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('uses Netlify deploy origins before the safe localhost default', async () => {
    const { getApplicationUrl } = await import('@/lib/auth/service');

    vi.stubEnv('APP_URL', '');
    vi.stubEnv('DEPLOY_PRIME_URL', 'https://preview.example.netlify.app');
    vi.stubEnv('URL', 'https://production.example.netlify.app');
    expect(getApplicationUrl()).toBe('https://preview.example.netlify.app');

    vi.stubEnv('DEPLOY_PRIME_URL', '');
    expect(getApplicationUrl()).toBe('https://production.example.netlify.app');

    vi.stubEnv('URL', '');
    expect(getApplicationUrl()).toBe('http://localhost:3000');
  });
});

describe('Netlify repository configuration', () => {
  it('uses the automatic Next.js runtime with a frozen pnpm install', () => {
    const config = readFileSync(resolve(repositoryRoot, 'netlify.toml'), 'utf8');

    expect(config).toMatch(/command\s*=\s*"pnpm build"/);
    expect(config).toMatch(/publish\s*=\s*"\.next"/);
    expect(config).toMatch(/NODE_VERSION\s*=\s*"24"/);
    expect(config).toMatch(/PNPM_FLAGS\s*=\s*"--frozen-lockfile"/);
    expect(config).not.toMatch(/@netlify\/plugin-nextjs|SUPABASE|SECRET|RATE_LIMIT|Content-Security-Policy|Strict-Transport-Security/i);
  });

  it('documents context isolation without committing credentials', () => {
    const readme = readFileSync(resolve(repositoryRoot, 'README.md'), 'utf8');
    const environmentTemplate = readFileSync(resolve(repositoryRoot, '.env.example'), 'utf8');

    expect(readme).toContain('http://localhost:3000');
    expect(readme).toContain('https://qingya-erp-163.netlify.app');
    expect(readme).toContain('Deploy Preview');
    expect(readme).toContain(productionRef);
    expect(readme).toMatch(/SUPABASE_SECRET_KEY.*Functions/s);
    expect(readme).toMatch(/RATE_LIMIT_PEPPER.*Functions/s);
    expect(environmentTemplate).toMatch(/^NEXT_PUBLIC_SUPABASE_URL=$/m);
    expect(environmentTemplate).toMatch(/^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$/m);
    expect(environmentTemplate).toMatch(/^SUPABASE_SECRET_KEY=$/m);
    expect(environmentTemplate).toMatch(/^RATE_LIMIT_PEPPER=$/m);
    expect(environmentTemplate).toMatch(/^APP_URL=$/m);
    expect(environmentTemplate).not.toContain(productionRef);
    expect(environmentTemplate).not.toMatch(/sb_(?:secret|publishable)_\w+/);
  });
});
