import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(import.meta.dirname, '../..');

describe('repository operator script safety', () => {
  it('does not ship obsolete credential, direct-database, or main-push tools', () => {
    const unsafeLegacyTools = [
      'scripts/db-tool.js',
      'scripts/init-database.js',
      'scripts/init-four-level-order-wages.sql',
      'scripts/init-order-enterprise-flow.sql',
      'scripts/init-org-employees-positions.sql',
      'scripts/init-permissions-order-exchanges.sql',
      'scripts/init-supabase.sql',
      'scripts/init-tenant-join-requests.sql',
      'scripts/pre-sync.sh',
      'scripts/push-workflows.sh',
      'scripts/seed-progress.js',
      'scripts/setup-runner.sh',
      'scripts/supabase-env.js',
      'scripts/sync.sh',
    ];

    for (const path of unsafeLegacyTools) {
      expect(existsSync(resolve(repositoryRoot, path)), path).toBe(false);
    }
  });

  it('keeps retained shell helpers on pnpm and away from direct main pushes', () => {
    const retainedHelpers = [
      'scripts/prepare.sh',
      'scripts/validate.sh',
      'start-all.sh',
      'start-local.sh',
    ].map((path) => readFileSync(resolve(repositoryRoot, path), 'utf8')).join('\n');

    expect(retainedHelpers).not.toMatch(/\b(?:npm|yarn)\s+(?:install|run)\b/);
    expect(retainedHelpers).not.toMatch(/git\s+push\s+(?:origin\s+)?main\b/);
  });
});
