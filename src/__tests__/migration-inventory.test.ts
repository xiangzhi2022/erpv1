import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const fixtureRoots: string[] = [];

afterEach(() => {
  for (const fixtureRoot of fixtureRoots.splice(0)) {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

describe('database migration inventory', () => {
  it('reports an applied remote migration that is missing locally', () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), 'erp-migrations-'));
    fixtureRoots.push(fixtureRoot);

    const migrationsDir = join(fixtureRoot, 'migrations');
    const remoteFile = join(fixtureRoot, 'remote.json');
    mkdirSync(migrationsDir);
    writeFileSync(
      join(migrationsDir, '20260817083043_v2_platform_core.sql'),
      'select 1;\n',
    );
    writeFileSync(
      remoteFile,
      JSON.stringify(['20260817083043', '20260817092158']),
    );

    const result = spawnSync(
      process.execPath,
      [
        'scripts/verify-migration-history.mjs',
        '--local-dir',
        migrationsDir,
        '--remote-versions-file',
        remoteFile,
      ],
      { cwd: process.cwd(), encoding: 'utf8' },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('20260817092158');
  });

  it('reports a local migration that is not present in remote history', () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), 'erp-migrations-'));
    fixtureRoots.push(fixtureRoot);

    const migrationsDir = join(fixtureRoot, 'migrations');
    const remoteFile = join(fixtureRoot, 'remote.json');
    mkdirSync(migrationsDir);
    writeFileSync(
      join(migrationsDir, '20260817083043_v2_platform_core.sql'),
      'select 1;\n',
    );
    writeFileSync(
      join(migrationsDir, '20260817092158_v2_platform_rls.sql'),
      'select 1;\n',
    );
    writeFileSync(remoteFile, JSON.stringify(['20260817083043']));

    const result = spawnSync(
      process.execPath,
      [
        'scripts/verify-migration-history.mjs',
        '--local-dir',
        migrationsDir,
        '--remote-versions-file',
        remoteFile,
      ],
      { cwd: process.cwd(), encoding: 'utf8' },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('20260817092158');
  });

  it('reads structured migration history from the Supabase CLI', () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), 'erp-migrations-'));
    fixtureRoots.push(fixtureRoot);

    const migrationsDir = join(fixtureRoot, 'migrations');
    const binDir = join(fixtureRoot, 'bin');
    const supabaseBin = join(binDir, 'supabase');
    mkdirSync(migrationsDir);
    mkdirSync(binDir);
    writeFileSync(
      join(migrationsDir, '20260817083043_v2_platform_core.sql'),
      'select 1;\n',
    );
    writeFileSync(
      supabaseBin,
      [
        '#!/bin/sh',
        `printf '%s\\n' '${JSON.stringify({
          migrations: [
            {
              local: '20260817083043',
              remote: '20260817083043',
              time: '2026-08-17 08:30:43',
            },
          ],
          message: 'Migrations listed',
        })}'`,
      ].join('\n'),
    );
    chmodSync(supabaseBin, 0o755);

    const result = spawnSync(
      process.execPath,
      [
        'scripts/verify-migration-history.mjs',
        '--local-dir',
        migrationsDir,
        '--local',
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: { ...process.env, PATH: `${binDir}:${process.env.PATH || ''}` },
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Migration history matches (1 versions)');
  });
});
