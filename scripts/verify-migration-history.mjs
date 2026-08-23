import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const localDirectory = readArgument('--local-dir') || 'supabase/migrations';
const remoteVersionsFile = readArgument('--remote-versions-file');

function readRemoteVersions() {
  if (remoteVersionsFile) {
    return JSON.parse(readFileSync(remoteVersionsFile, 'utf8'));
  }

  const target = process.argv.includes('--local') ? '--local' : '--linked';
  const result = spawnSync(
    'supabase',
    ['migration', 'list', target, '--output-format', 'json'],
    { encoding: 'utf8' },
  );

  if (result.error || result.status !== 0) {
    const detail = result.error?.message || result.stderr || 'unknown error';
    throw new Error(`Unable to read Supabase migration history: ${detail.trim()}`);
  }

  const payload = JSON.parse(result.stdout);
  return payload.migrations
    .map((migration) => migration.remote)
    .filter((version) => typeof version === 'string' && version.length > 0);
}

try {
  const localVersions = new Set(
    readdirSync(localDirectory)
      .filter((fileName) => /^\d{14}_.+\.sql$/.test(fileName))
      .map((fileName) => fileName.slice(0, 14)),
  );
  const remoteVersions = readRemoteVersions();
  const remoteVersionSet = new Set(remoteVersions);
  const missingLocally = remoteVersions.filter(
    (version) => !localVersions.has(version),
  );
  const missingRemotely = [...localVersions].filter(
    (version) => !remoteVersionSet.has(version),
  );

  if (missingLocally.length > 0 || missingRemotely.length > 0) {
    if (missingLocally.length > 0) {
      process.stderr.write(
        `Applied remote migrations missing locally: ${missingLocally.join(', ')}\n`,
      );
    }
    if (missingRemotely.length > 0) {
      process.stderr.write(
        `Local migrations missing from remote history: ${missingRemotely.join(', ')}\n`,
      );
    }
    process.exitCode = 1;
  } else {
    process.stdout.write(
      `Migration history matches (${remoteVersions.length} versions)\n`,
    );
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 2;
}
