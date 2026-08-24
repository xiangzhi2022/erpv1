import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const committedTypesPath = fileURLToPath(
  new URL('../src/db/database.types.ts', import.meta.url),
);

const generated = spawnSync(
  'pnpm',
  ['exec', 'supabase', 'gen', 'types', 'typescript', '--local'],
  {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  },
);

if (generated.status !== 0) {
  console.error(
    'Unable to generate local database types. Start Supabase with `pnpm db:start` and retry.',
  );
  process.exit(generated.status ?? 1);
}

const normalize = (value) => value.replaceAll('\r\n', '\n').trimEnd();
const committed = readFileSync(committedTypesPath, 'utf8');

if (normalize(generated.stdout) !== normalize(committed)) {
  const artifactPath = process.env.DATABASE_TYPES_ARTIFACT_PATH;
  if (artifactPath) {
    writeFileSync(artifactPath, generated.stdout);
  }

  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'erp-db-types-'));
  const generatedTypesPath = join(temporaryDirectory, 'database.types.ts');

  try {
    writeFileSync(generatedTypesPath, generated.stdout);
    const diff = spawnSync(
      'diff',
      [
        '-u',
        '--label',
        'src/db/database.types.ts (committed)',
        '--label',
        'src/db/database.types.ts (generated)',
        committedTypesPath,
        generatedTypesPath,
      ],
      { encoding: 'utf8' },
    );

    if (diff.stdout) {
      process.stderr.write(diff.stdout);
    }
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }

  console.error(
    'Generated Supabase types are stale. Run `pnpm db:types`, review the diff, and commit src/db/database.types.ts.',
  );
  process.exit(1);
}

console.log('Generated Supabase database types match the local migration schema.');
