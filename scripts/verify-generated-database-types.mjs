import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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
  console.error(
    'Generated Supabase types are stale. Run `pnpm db:types`, review the diff, and commit src/db/database.types.ts.',
  );
  process.exit(1);
}

console.log('Generated Supabase database types match the local migration schema.');
