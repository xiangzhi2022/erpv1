import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(import.meta.dirname, '../..');

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx|mjs|js)$/.test(entry.name) ? [path] : [];
  });
}

function relativeOffenders(files: string[], pattern: RegExp): string[] {
  return files.filter((file) => pattern.test(readFileSync(file, 'utf8')))
    .map((file) => relative(repositoryRoot, file));
}

describe('production source safety', () => {
  const applicationSources = sourceFiles(resolve(repositoryRoot, 'src'))
    .filter((file) => !file.includes(`${join('src', '__tests__')}`));

  it('does not retain process-memory authentication or demo credential defaults', () => {
    const authSources = applicationSources.filter((file) => (
      file.includes(`${join('src', 'lib', 'auth')}`)
      || file.includes(`${join('src', 'app', 'api', 'auth')}`)
    ));

    expect(relativeOffenders(authSources, /\bnew\s+Map\s*(?:<|\()/)).toEqual([]);
    expect(relativeOffenders(applicationSources, /\bpassword\s*[:=]\s*['"][^'"]{4,}['"]/i)).toEqual([]);
  });

  it('keeps new database migrations free of plaintext password columns', () => {
    const migrations = readdirSync(resolve(repositoryRoot, 'supabase/migrations'))
      .filter((name) => name >= '20260823000000' && name.endsWith('.sql'))
      .map((name) => resolve(repositoryRoot, 'supabase/migrations', name));

    expect(relativeOffenders(migrations, /\bpassword\s+(?:text|varchar|character varying)\b/i)).toEqual([]);
  });

  it('keeps Secret Key access out of routes, actions, and client components', () => {
    const requestCode = applicationSources.filter((file) => (
      file.includes(`${join('src', 'app', 'api')}`)
      || file.includes(`${join('src', 'app', 'actions')}`)
      || /[\\/]page\.tsx$/.test(file)
      || /[\\/]components[\\/]/.test(file)
    ));

    expect(relativeOffenders(requestCode, /SUPABASE_SECRET_KEY|createAdminClient|getSupabaseServiceClient/)).toEqual([]);
  });

  it('does not allow wildcard image hosts or public production diagnostics', () => {
    const nextConfig = readFileSync(resolve(repositoryRoot, 'next.config.ts'), 'utf8');
    const routePolicy = readFileSync(resolve(repositoryRoot, 'src/lib/api/route-policy.ts'), 'utf8');
    const debugGuard = readFileSync(resolve(repositoryRoot, 'src/app/api/debug/_lib/env-guard.ts'), 'utf8');

    expect(nextConfig).not.toMatch(/hostname\s*:\s*['"]\*['"]|remotePatterns\s*:\s*\[\s*\{?\s*protocol\s*:\s*['"]https?['"]\s*\}?\s*\]/s);
    expect(routePolicy).toMatch(/developmentRoutes\(\[\s*'\/api\/debug\/env'[\s\S]*'\/api\/debug\/user'/);
    expect(debugGuard).toMatch(/NODE_ENV\s*!==\s*'production'/);
    expect(debugGuard).toMatch(/status:\s*404/);
  });

  it('never enables CAPTCHA bypass by default', () => {
    const trackedConfig = [
      '.env.example',
      'netlify.toml',
      'package.json',
      '.github/workflows/ci.yml',
    ].map((name) => resolve(repositoryRoot, name));

    expect(relativeOffenders(trackedConfig, /SKIP_CAPTCHA\s*=\s*(?:1|true)/i)).toEqual([]);
  });
});
