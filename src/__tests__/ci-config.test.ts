import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = process.cwd();
const workflowPath = path.join(repositoryRoot, '.github/workflows/ci.yml');

interface WorkflowStep {
  env?: Record<string, string>;
  if?: string;
  name?: string;
  run?: string;
  uses?: string;
  with?: Record<string, boolean | string>;
}

interface WorkflowJob {
  permissions?: Record<string, string>;
  'runs-on'?: string;
  steps: WorkflowStep[];
  'timeout-minutes'?: number;
}

interface Workflow {
  jobs: Record<string, WorkflowJob>;
  name: string;
  on: Record<string, unknown>;
  permissions: Record<string, string>;
}

function loadWorkflow(): Workflow {
  return JSON.parse(readFileSync(workflowPath, 'utf8')) as Workflow;
}

function commands(job: WorkflowJob): string[] {
  return job.steps.flatMap((step) => step.run ? [step.run] : []);
}

describe('GitHub Actions production-safety gates', () => {
  it('tracks the CI workflow instead of ignoring it', () => {
    const ignored = spawnSync(
      'git',
      ['check-ignore', '--quiet', '.github/workflows/ci.yml'],
      { cwd: repositoryRoot },
    );

    expect(ignored.status).toBe(1);
  });

  it('runs read-only CI for pull requests and main without privileged triggers', () => {
    const workflow = loadWorkflow();

    expect(workflow.on).toEqual({
      pull_request: {},
      push: { branches: ['main'] },
    });
    expect(workflow.permissions).toEqual({ contents: 'read' });
    expect(workflow.on).not.toHaveProperty('pull_request_target');

    for (const job of Object.values(workflow.jobs)) {
      const checkout = job.steps.find((step) => step.uses === 'actions/checkout@v4');
      const setupPnpm = job.steps.find((step) => step.uses === 'pnpm/action-setup@v4');
      const setupNode = job.steps.find((step) => step.uses === 'actions/setup-node@v4');

      expect(checkout?.with?.['persist-credentials']).toBe(false);
      expect(setupPnpm?.with?.version).toBe('9.0.0');
      expect(setupNode?.with).toMatchObject({
        cache: 'pnpm',
        'node-version': '24',
      });
      expect(commands(job)).toContain('pnpm install --frozen-lockfile');
      expect(job['timeout-minutes']).toBeGreaterThan(0);
    }
  });

  it('builds and validates the app without injecting server secrets', () => {
    const { app } = loadWorkflow().jobs;
    const build = app.steps.find((step) => step.run === 'pnpm build');

    expect(commands(app)).toEqual(expect.arrayContaining([
      'pnpm lint',
      'pnpm ts-check',
      'pnpm test',
      'pnpm build',
    ]));
    expect(build?.env).toEqual({
      APP_URL: 'https://ci.invalid',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_ci_placeholder',
      NEXT_PUBLIC_SUPABASE_URL: 'https://ci-placeholder.supabase.co',
    });
  });

  it('tests only the local database and always stops it', () => {
    const { database } = loadWorkflow().jobs;
    const databaseCommands = commands(database);
    const cleanup = database.steps.find(
      (step) => step.run === 'pnpm db:stop -- --no-backup',
    );

    expect(databaseCommands).toEqual(expect.arrayContaining([
      'pnpm db:start',
      'pnpm db:reset',
      'pnpm db:test',
      'pnpm db:lint',
      'pnpm db:types:check',
    ]));
    expect(cleanup?.if).toBe('${{ always() }}');
  });

  it('contains no production project reference, secret context, or remote database command', () => {
    const serializedWorkflow = JSON.stringify(loadWorkflow());

    expect(serializedWorkflow).not.toContain('jfcsbwdawvsxnmovwlgl');
    expect(serializedWorkflow).not.toMatch(/secrets\./i);
    expect(serializedWorkflow).not.toMatch(/SUPABASE_(?:SECRET_KEY|ACCESS_TOKEN)/i);
    expect(serializedWorkflow).not.toMatch(/RATE_LIMIT_PEPPER/i);
    expect(serializedWorkflow).not.toMatch(/supabase\s+link/i);
    expect(serializedWorkflow).not.toMatch(/(?:supabase\s+)?db\s+push/i);
    expect(serializedWorkflow).not.toMatch(/--project-ref/i);
  });
});
