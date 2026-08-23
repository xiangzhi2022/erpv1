# Phase 1 forward-only rollback runbook

> Status: **template only — not executed and not rehearsed**. This document does not authorize a rollback or any production change.

Phase 1 migrations are additive and forward-only. “Rollback” means containing impact, deploying the previously approved application, disabling new entry points, and—only when necessary—applying a newly reviewed compensating migration. It does not mean reversing migration history or restoring a backup over production.

## Absolute prohibitions

- Never run `supabase db reset` on a linked, staging-with-preserved-data, or production target.
- Never use `DROP ... CASCADE`, truncate production data, delete or mark production migration-history rows as reverted, or run a down migration.
- Never restore `schema.sql`, `roles.sql`, `data.sql`, a physical snapshot, or any other dump over production as a routine rollback.
- Never overwrite the production database, switch a preview environment to the production project, or point an isolated rehearsal command at project `jfcsbwdawvsxnmovwlgl`.
- Never paste SQL into the Dashboard, run legacy `scripts/init-*.sql`, or improvise a production data repair.
- Never expose credentials, connection strings, keys, cookies, tokens, identifier inventories, PII, or business rows in logs, tickets, CI artifacts, or chat.
- A partial failure is not permission to retry a write. Stop and obtain a new, exact authorization.

A full production restore is a disaster-recovery event, not this rollback procedure. It requires the platform owner's separate disaster-recovery plan, incident command, restore-point selection, data-loss acceptance, and explicit authorization.

## Incident roles and independent authorizations

Assign an incident commander, database operator, application operator, reviewer, and recorder. One person may not both execute and approve a database compensation.

Every production write operation requires a separate authorization naming its exact target and payload. Do not bundle these rows:

| Potential operation | Required exact scope | Separate authorization ID | Operator | Reviewer | UTC time | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Enable maintenance/read-only mode | Entry points or configuration changed |  |  |  |  | Not authorized |
| Disable a new feature entry point | Exact route, flag, or permission |  |  |  |  | Not authorized |
| Deploy prior application | Exact prior commit/artifact |  |  |  |  | Not authorized |
| Apply compensating migration | Exact new migration version and checksum |  |  |  |  | Not authorized |
| Perform scoped data correction | Exact rows/predicate and reviewed transaction |  |  |  |  | Not authorized |
| Change Supabase Auth settings | Exact setting and before/after value |  |  |  |  | Not authorized |
| Change Netlify environment | Exact variable names and context |  |  |  |  | Not authorized |
| Exit maintenance/read-only mode | Exact configuration changed |  |  |  |  | Not authorized |

If containment takes two production writes, it needs two authorizations. An incident declaration or a general “rollback approved” message does not replace them.

## 1. Declare, observe, and stop additional writes

Record without sensitive payloads:

- incident ID, start time, reporter, and user-visible symptoms;
- reviewed application commit and migration versions currently deployed;
- request IDs and sanitized error codes, not request bodies or identity data;
- last known healthy time and the exact failed gate;
- whether the database migration command completed, failed, or has unknown status.

Run only read-only checks first. Production inventory access itself requires its recorded read authorization. If `supabase/.temp/project-ref` is missing or different, stop and follow the explicit protected-profile link procedure in `docs/runbooks/phase-1-migration.md` within that read authorization; linking writes only ignored local CLI metadata and does not authorize a production database change. Production mode of `verify:production-readiness` performs only Management API GET requests for migration history and advisors; it does not execute the non-production full gate and does not grant readiness or deployment approval.

```bash
set -eu
set +x
git rev-parse HEAD
test -f supabase/.temp/project-ref
test "$(tr -d '\r\n' < supabase/.temp/project-ref)" = 'jfcsbwdawvsxnmovwlgl'
pnpm exec supabase migration list --linked
SUPABASE_TARGET_PROJECT_REF=jfcsbwdawvsxnmovwlgl \
  ALLOW_PRODUCTION_READ_ONLY_CHECKS=1 \
  pnpm verify:production-readiness
```

If `verify:production-readiness` is missing, writes migrations, or does not fail closed for the production reference, do not use it; record the missing gate and stop. Do not infer migration state from application errors alone.

## 2. Contain the incident

Choose the narrowest containment that stops new unsafe activity:

1. Disable only the affected new entry point, queue consumer, scheduled job, or mutation.
2. If narrow containment is insufficient, enter the documented maintenance/read-only mode.
3. Preserve healthy read paths where authorization and tenant isolation remain correct.

Each feature-flag, route, job, Netlify, Supabase, or maintenance-mode change is a production write and needs its own authorization row. Record the before value and intended after value before execution. Do not use a secret value as evidence.

If there is evidence of cross-enterprise access, credential exposure, destructive data mutation, or active exploitation, keep writes disabled and escalate to the security incident procedure. Key rotation, session revocation, or user suspension requires separately scoped authorization; do not perform it automatically under this runbook.

## 3. Select the forward-only response

Use this order:

### A. Application-only regression

Deploy the previously reviewed and retained application artifact that is compatible with the **current** database schema. Confirm its commit and immutable artifact identifier; do not rebuild an old branch with current dependencies.

The production deploy is one separate authorized write. Do not change Supabase Auth settings, Netlify variables, or database state as part of the same authorization.

After deploy, run read-only smoke checks for login/logout, token refresh, enterprise selection, 401/403 behavior, cross-enterprise denials, categories/tasks/notifications, request IDs, rate-limit responses, and security headers. Use dedicated test identities and record no PII or tokens.

### B. New entry point is unsafe but prior app cannot be deployed

Keep the affected entry point disabled. Prepare a minimal reviewed application patch against the current schema. Run lint, typecheck, tests, build, local database tests, and non-production smoke checks. Deployment and re-enabling the entry point are two separate production writes and require two authorizations.

### C. Database behavior requires correction

Create a **new forward-only compensating migration**. It may add or correct schema, grants, RLS, functions, triggers, or indexes; it must not erase migration history or destructively remove production objects/data. Generate it using the repository's migration workflow, review the full SQL, and rehearse it against both a clean database and a restored production snapshot.

Before production apply, repeat the backup and isolated-restore procedure in `docs/runbooks/phase-1-migration.md` using a new absolute directory under:

```text
/var/backups/qingya-erp/phase-1/<new-UTC-run-id>
```

Verify `SHA256SUMS`, isolated restore, row counts, and protected ID-set checksums. A backup made before the original migration remains evidence, but it does not replace a fresh pre-compensation backup.

The compensating migration gets its own review and its own production authorization naming the exact new version and checksum. Preview the pending set read-only before applying:

```bash
test -f supabase/.temp/project-ref
test "$(tr -d '\r\n' < supabase/.temp/project-ref)" = 'jfcsbwdawvsxnmovwlgl'
pnpm exec supabase db push --linked --skip-vault --dry-run
```

Only after the dry run exactly matches the authorized version may the operator execute the single authorized write:

```bash
test -f supabase/.temp/project-ref
test "$(tr -d '\r\n' < supabase/.temp/project-ref)" = 'jfcsbwdawvsxnmovwlgl'
pnpm exec supabase db push --linked --skip-vault
```

Do not use `--include-all`, `--include-seed`, `--include-roles`, manual SQL, history repair, or a second write under the same authorization.

### D. Data correction is unavoidable

Keep affected writes disabled. Define an exact tenant-scoped predicate, expected row count, before/after invariant, transaction boundary, verification query, and abort condition. Rehearse against the isolated restored snapshot. Require database/security review and a separate production authorization for the exact correction.

If the affected rows cannot be identified without ambiguity, stop. Do not run a broad update, delete, truncate, or restore. This runbook deliberately provides no generic production data-mutation command because an unspecified predicate is unsafe.

## 4. Validate recovery before reopening writes

All applicable checks must pass:

- [ ] current production migration history is recorded and understood;
- [ ] production backup checksum remains valid at its resolved absolute location;
- [ ] prior app or patch is compatible with the current forward-only schema;
- [ ] tenant RLS, grants, and SECURITY DEFINER boundaries were reviewed;
- [ ] dedicated tests confirm cross-enterprise direct-ID access is denied;
- [ ] Auth flows and enterprise selection work;
- [ ] affected mutations succeed once and reject conflicts/replays correctly;
- [ ] categories, tasks, notifications, and money/production boundaries behave safely;
- [ ] unknown errors return a stable request ID without leaking internals;
- [ ] Supabase security/performance advisor findings are reviewed;
- [ ] application lint, typecheck, tests, and build pass;
- [ ] the incident commander and reviewer approve the recovery evidence.

Exiting maintenance mode, re-enabling a route/job, or changing a flag is a new production write. Obtain its own authorization and change only the recorded setting. Monitor sanitized request/error rates and database health; do not log payloads or secrets.

## 5. Evidence and closeout

| Evidence | Location or sanitized result | Reviewer | UTC time |
| --- | --- | --- | --- |
| Incident timeline and request IDs | Not recorded |  |  |
| Production migration history | Not checked |  |  |
| Containment changes and authorizations | None executed |  |  |
| Prior application artifact compatibility | Not checked |  |  |
| Backup absolute directory | Not recorded |  |  |
| Backup checksum verification | Not run |  |  |
| Isolated restore and rehearsal | Not run |  |  |
| Compensating migration review/checksum | Not applicable |  |  |
| Clean and restored-snapshot database gates | Not run |  |  |
| Application and smoke-test gates | Not run |  |  |
| Production validation | Not run |  |  |
| Reopen-writes authorization | Not authorized |  |  |

Document the root cause, why the chosen forward-only response was safe, follow-up owners, and expiry/removal dates for temporary flags. Do not claim the rollback, restore, rehearsal, or checks succeeded until the corresponding evidence exists and has been reviewed.
