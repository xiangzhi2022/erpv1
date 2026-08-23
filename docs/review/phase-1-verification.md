# Phase 1 production-readiness verification

Status: **not approved for production rollout**

This record contains no credentials, personal data, database dumps, or production
write authorization. It distinguishes repository evidence from checks that still
require an isolated rehearsal environment or an explicitly approved production
maintenance window.

## Repository baseline

- Working branch: `codex/erp-production-readiness-design`
- Supabase production project ref: `jfcsbwdawvsxnmovwlgl`
- Production application origin: `https://qingya-erp-163.netlify.app`
- Runtime contract: Node.js 24, pnpm 9, standard Next.js 16 lifecycle
- Migration source of truth: `supabase/migrations/`

## Verified repository gates

The following repository gates passed on 2026-08-23. Re-run
`pnpm verify:production-readiness` against an explicit non-production target
after the remaining operational and database gates are resolved. This host ran
Node.js 25.6.0; CI and Netlify must run the repository contract, Node.js 24.

| Gate | Current evidence |
| --- | --- |
| Frozen dependency install | `pnpm install --frozen-lockfile` passed |
| ESLint | `pnpm lint` passed with zero warnings |
| TypeScript | `pnpm ts-check` passed |
| Vitest | `pnpm test` passed: 86 files, 582 tests |
| Next.js build | `pnpm build` passed and produced 147 routes |
| Source safety | Auth/session, debug-route, Secret Key, deploy-context, and legacy-script scans are committed |
| Independent review | Final combined diff review found no remaining reachable P0/P1 repository finding |
| Database runtime gates | Blocked locally: pgTAP and DB lint could not connect to `127.0.0.1:54322`; generated-type comparison could not start without local Supabase |

## Supabase migration and advisor evidence

Read-only Supabase connector checks on 2026-08-23 reported five migrations on
the production project:

- `20260817083043_v2_platform_core`
- `20260817092158_v2_platform_rls`
- `20260817105633_v2_platform_iam`
- `20260817152357_v2_platform_idempotency`
- `20260817180901_v2_platform_audit`

The repository currently contains 43 migrations. Therefore 38 repository
migrations are not recorded on production. This is expected until an approved
rollout; none were applied during this work.

The production Security Advisor reported:

- two informational, fail-closed service-table notices for
  `api_idempotency_keys` and `identity_action_requests` having RLS with no public
  policies;
- leaked-password protection disabled (release blocker).

The Performance Advisor reported three missing covering foreign-key indexes.
Repository migration `20260823092000_v2_advisor_indexes.sql` addresses those
three indexes, but production cannot be considered remediated until the full
migration sequence is rehearsed, approved, applied, and the advisors are rerun.
Unused-index informational notices are not evidence that an index is safe to
remove; no production indexes were changed.

## Release blockers

1. Git history contains historical Supabase `service_role` JWT material even
   though current HEAD is clean. Rotate/revoke all affected high-privilege keys
   first, verify deployed environments use only replacements, then coordinate a
   history rewrite. History rewriting does not revoke a credential.
2. Identity, direct-write, order workflow, scoped production access, worker,
   component, finite-numeric, and order-parent fixes have repository regression
   coverage and passed final combined review, but their SQL has not run against
   a clean Supabase database or a restored snapshot.
3. Enable Supabase Auth leaked-password protection and verify the Site URL,
   redirect allowlist, identity providers, SMTP/SMS settings, and CAPTCHA policy.
4. Run a clean local migration reset, pgTAP, database lint, and generated-type
   check. The Supabase CLI is installed, but this host has no Docker/Podman, so
   the database-backed commands have not run here.
5. Restore a reviewed production snapshot into an isolated non-production
   Supabase project or branch, apply all 38 pending migrations there, and prove preserved v2 row
   IDs/counts plus successful Auth and cross-enterprise denial flows.
6. Create and verify an external backup with checksums. No backup was created
   because no explicit `ERP_BACKUP_DIR` or production backup authorization was
   provided.
7. Obtain separate authorization for push/PR, credential rotation, production
   backup, migrations, Auth settings, Netlify environment changes, and deploy.

## Rehearsal evidence template

Record these artifacts outside Git if they contain operational details or data:

- target project/branch ref (never a key or database password);
- production snapshot timestamp and approved row-count-only inventory;
- absolute backup directory and SHA-256 checksum manifest location;
- clean reset output and upgraded-snapshot output;
- migration history before and after rehearsal;
- pgTAP, database lint, generated-type, ESLint, TypeScript, Vitest, and build output;
- Security and Performance Advisor results;
- Auth confirmation/reset/OAuth and protected-shell results;
- direct-ID, forged-enterprise, worker self-only, partner-redaction, and cookie-switch denials;
- rollback decision owner and deploy/rollback commit identifiers.

Do not attach raw dumps, access tokens, Secret Keys, password material, session
cookies, email addresses, phone numbers, or other personal data to this file.
