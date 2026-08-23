# ERP Production Safety Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Use `superpowers:test-driven-development` for every behavior change and `superpowers:verification-before-completion` before claiming a task or the phase complete.

**Goal:** Replace the current process-memory authentication and unguarded legacy data access with a production-safe Supabase Auth/SSR, enterprise/RBAC, migration, RLS, API, security, and CI foundation while preserving the existing Supabase v2 organization/IAM data.

**Architecture:** Treat the five already-applied Supabase v2 migrations as an immutable baseline. Keep their database column name `tenant_id` inside the v2 IAM schema, but expose the concept as `enterpriseId` in application types; all newly created ERP business tables use `enterprise_id REFERENCES public.enterprises(id)`. Requests use a request-scoped `@supabase/ssr` client and verified Auth claims, then resolve one active enterprise membership and effective grants. RLS remains the final data boundary; route handlers add Zod validation, stable response envelopes, rate limits, idempotency, and audit-friendly request IDs.

**Tech Stack:** Next.js 16 App Router/Proxy, React 19, TypeScript 5 strict mode, Supabase Auth/Postgres/RLS, `@supabase/ssr` 0.12.4, `@supabase/supabase-js` 2.95.3, Supabase CLI 2.115.0, Drizzle ORM, Zod 4, Vitest, pgTAP, pnpm 9, Netlify Next.js Runtime.

**Approved spec:** `docs/superpowers/specs/2026-08-23-erp-production-readiness-design.md`

## Global constraints

- Do not delete, reset, truncate, or rename the production v2 tables or their existing rows.
- Do not apply a production migration until the schema/data backup, clean-database reset, preserved-v2-data rehearsal, and reviewer checkpoint in Task 14 are complete.
- Never use `SUPABASE_SECRET_KEY` for ordinary user reads or writes. It is limited to migrations, controlled Auth administration, and the server-only rate-limit RPC.
- Do not trust an active-enterprise cookie, URL parameter, user metadata, or client-supplied role. Every protected request revalidates `auth.uid()`, active membership, resource enterprise, and permission.
- All implementation commands use pnpm. Do not use npm, yarn, `npx`, or ad-hoc SQL init scripts.
- Every task follows red-green-refactor: add the focused failing test, run it and see the expected failure, implement the minimum change, rerun the focused test, then run the relevant regression suite.
- Commit after each task with only that task's files. Do not push, merge, deploy, or modify production Supabase unless the user explicitly authorizes that separate operation.

## Verified starting point (2026-08-23)

- Production project: `jfcsbwdawvsxnmovwlgl`.
- Applied migrations: `v2_platform_core`, `v2_platform_rls`, `v2_platform_iam`, `v2_platform_idempotency`, `v2_platform_audit`.
- Existing public tables: `enterprises`, `enterprise_memberships`, `sites`, `org_units`, `workshops`, `workstations`, `permission_catalog`, `roles`, `role_permissions`, `role_bindings`, `role_binding_sites`, `role_binding_workshops`, `api_idempotency_keys`, `audit_events`, `identity_action_requests`.
- Existing private table: `app_private.security_events`.
- Existing public RPCs: `authorize_enterprise_selection(...)`, `current_enterprise_grants(uuid)`; supporting authorization/idempotency/audit functions live in `app_private`.
- All existing public tables have RLS enabled. `api_idempotency_keys` and `identity_action_requests` intentionally have no user policy because they are accessed only through controlled functions; document this exception instead of adding permissive policies.
- Security advisor warning: leaked-password protection is disabled. Performance advisor reports missing covering indexes on `audit_events`, `role_binding_sites`, and `role_binding_workshops`.
- The publishable key found in the historical local `.env` returned HTTP 401 against the Data API. Treat it as stale; retrieve an active publishable key through the project dashboard/management API during environment setup and never print it into logs or documentation.
- Repository baseline: 16 test files and 181 tests pass; TypeScript passes; ESLint has 12 warnings; production build passes only through a custom script that reinstalls dependencies and bundles an unused server.

---

### Task 1: Add reproducible Supabase project tooling and capture the remote v2 baseline

**Files:**

- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `supabase/config.toml`
- Create: `supabase/migrations/20260817083043_v2_platform_core.sql`
- Create: `supabase/migrations/20260817092158_v2_platform_rls.sql`
- Create: `supabase/migrations/20260817105633_v2_platform_iam.sql`
- Create: `supabase/migrations/20260817152357_v2_platform_idempotency.sql`
- Create: `supabase/migrations/20260817180901_v2_platform_audit.sql`
- Create: `docs/database/production-schema-inventory.md`
- Create: `scripts/verify-migration-history.mjs`
- Test: `src/__tests__/migration-inventory.test.ts`

- [ ] **Step 1: Write the failing migration-history behavior test.** Run the real script against a temporary migration directory and a fixture containing the remote versions; assert its exit status and diagnostics. This test catches a missing local migration or a remote-only version rather than merely grepping source text.

```ts
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('database migration inventory', () => {
  it('fails when an applied remote migration is missing locally', () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), 'erp-migrations-'));
    const migrationsDir = join(fixtureRoot, 'migrations');
    const remoteFile = join(fixtureRoot, 'remote.json');
    mkdirSync(migrationsDir);
    writeFileSync(join(migrationsDir, '20260817083043_v2_platform_core.sql'), 'select 1;');
    writeFileSync(remoteFile, JSON.stringify(['20260817083043', '20260817092158']));

    const result = spawnSync(process.execPath, [
      'scripts/verify-migration-history.mjs',
      '--local-dir', migrationsDir,
      '--remote-versions-file', remoteFile,
    ], { encoding: 'utf8' });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('20260817092158');
  });
});
```

- [ ] **Step 2: Run `pnpm test src/__tests__/migration-inventory.test.ts` and confirm it fails because the verification script does not yet return the required drift diagnostic.**

- [ ] **Step 3: Pin the CLI and add database scripts.**

```json
{
  "scripts": {
    "db:start": "supabase start",
    "db:stop": "supabase stop",
    "db:reset": "supabase db reset",
    "db:test": "supabase test db",
    "db:lint": "supabase db lint --level warning",
    "db:types": "supabase gen types typescript --local > src/db/database.types.ts",
    "db:history": "node scripts/verify-migration-history.mjs"
  },
  "devDependencies": {
    "supabase": "2.115.0"
  }
}
```

- [ ] **Step 4: Link the CLI to project `jfcsbwdawvsxnmovwlgl` without committing tokens or passwords, fetch the five migration versions, and compare their resulting schema against a catalog dump.** If the original SQL bodies cannot be fetched, reconstruct equivalent idempotent baseline files from `pg_catalog`, then prove they recreate the same tables, enums, constraints, functions, grants, policies, triggers, and indexes on a clean local database. Never invent an empty placeholder migration.

- [ ] **Step 5: Record the production inventory.** The document must list row counts only, migration versions, table/column/constraint names, grants, policies, functions, storage buckets, and advisor findings. It must not contain business rows, emails, phone numbers, JWTs, API keys, cookies, or database credentials.

- [ ] **Step 6: Implement `verify-migration-history.mjs` to compare local migration version prefixes with `supabase migration list` and fail on local/remote drift.** Parse structured output; never shell-interpolate credentials.

- [ ] **Step 7: Reset a clean local Supabase instance, run the inventory test, and run the database linter.**

Run: `pnpm db:start && pnpm db:reset && pnpm db:test && pnpm db:lint && pnpm test src/__tests__/migration-inventory.test.ts`

Expected: all commands pass; the local catalog contains the verified v2 baseline.

- [ ] **Step 8: Commit.**

```bash
git add package.json pnpm-lock.yaml supabase docs/database/production-schema-inventory.md scripts/verify-migration-history.mjs src/__tests__/migration-inventory.test.ts
git commit -m "chore: capture Supabase v2 migration baseline"
```

---

### Task 2: Make the v2 schema and generated database types the application truth source

**Files:**

- Create: `src/db/database.types.ts`
- Create: `src/db/v2-schema.ts`
- Modify: `src/db/schema.ts`
- Modify: `src/db/relations.ts`
- Create: `src/db/enterprise-types.ts`
- Test: `src/__tests__/database-types.test.ts`

- [ ] **Step 1: Add a failing type/shape test asserting that v2 enterprise, membership, RBAC, idempotency, and audit tables are exported and that no v2 IAM identifier is modeled as an arbitrary string.**

- [ ] **Step 2: Generate `src/db/database.types.ts` from the reset local database with `pnpm db:types`.** Commit the generated file so builds do not require network access.

- [ ] **Step 3: Model the verified v2 tables in `src/db/v2-schema.ts`.** Preserve the existing database name `tenant_id`; expose a branded application alias:

```ts
export type EnterpriseId = string & { readonly __brand: 'EnterpriseId' };

export interface EnterpriseContextRef {
  enterpriseId: EnterpriseId;
  membershipId: string;
  userId: string;
}
```

- [ ] **Step 4: Re-export the v2 schema from `src/db/schema.ts`, remove conflicting legacy `roles`/`role_permissions` declarations, and update `src/db/relations.ts` to reference `enterprises` and `enterpriseMemberships`.** Do not remove legacy business table declarations yet; their controlled conversion occurs in Task 3.

- [ ] **Step 5: Add a generated-type drift check to CI-facing scripts:** regenerate into a temporary file, compare with `src/db/database.types.ts`, and fail with an actionable message.

- [ ] **Step 6: Run `pnpm test src/__tests__/database-types.test.ts && pnpm ts-check`.**

- [ ] **Step 7: Commit.**

```bash
git add src/db package.json src/__tests__/database-types.test.ts
git commit -m "refactor: align application types with Supabase v2"
```

---

### Task 3: Add the ERP tenancy migration, constraints, indexes, grants, and RLS contract

**Files:**

- Create: `supabase/migrations/20260823090000_erp_tenancy_foundation.sql`
- Create: `supabase/migrations/20260823091000_erp_business_rls.sql`
- Create: `supabase/migrations/20260823092000_v2_advisor_indexes.sql`
- Modify: `src/db/schema.ts`
- Modify: `src/db/relations.ts`
- Create: `supabase/tests/erp_tenancy_rls.test.sql`
- Create: `supabase/tests/v2_advisor_regressions.test.sql`

- [ ] **Step 1: Write failing pgTAP tests for the tenancy contract.** Cover these assertions:

  - every ERP business table has a non-null `enterprise_id uuid` foreign key to `public.enterprises(id)`;
  - every enterprise-scoped unique key begins with `enterprise_id`;
  - every enterprise foreign key has a covering index;
  - RLS is enabled and forced on every ERP business table;
  - `anon` has no table write grants;
  - authenticated enterprise A cannot select, insert, update, or delete enterprise B rows;
  - service-only tables remain inaccessible to `anon` and `authenticated` without adding fake permissive policies.

- [ ] **Step 2: Run `pnpm db:test` and confirm the new tests fail against the baseline.**

- [ ] **Step 3: In `erp_tenancy_foundation.sql`, create or normalize the phase-one table set.** The enterprise-scoped set is: `profiles`, `customers`, `departments`, `positions`, `employees`, `employee_positions`, `employee_roles`, `order_prefixes`, `orders`, `order_spaces`, `order_products`, `order_modules`, `order_items`, `order_item_attachments`, `order_exchanges`, `factory_workshops`, `production_tasks`, `wage_rules`, `worker_wage_records`, `order_status_logs`, `work_orders`, `progress_logs`, `workers`, `suppliers`, `dealers`, `categories`, `tasks`, `notifications`, `user_settings`, and `enterprise_join_requests`. Keep `sites`, `org_units`, `workshops`, and RBAC in the v2 baseline instead of creating duplicates. Add `enterprises.enterprise_type` with allowed values `platform`, `manufacturer`, `dealer`, `supplier`, and `unclassified`; backfill existing rows to `unclassified` instead of guessing their business type, while new onboarding accepts only the four concrete types.

- [ ] **Step 4: Use `enterprise_id` for new ERP tables.** Add composite foreign keys such as `(enterprise_id, workshop_id)` wherever a child references another scoped row. Make money `numeric(18,2)`, quantities explicit, status values constrained, timestamps `timestamptz`, and mutable rows carry `updated_at`. No business table stores a password.

- [ ] **Step 5: Add `profiles.id REFERENCES auth.users(id) ON DELETE CASCADE` and an Auth-user trigger that creates only a blank safe profile.** Roles and enterprises must not come from `raw_user_meta_data`.

- [ ] **Step 6: Seed the immutable permission catalog and standard system roles using stable permission codes.** Use this exact catalog so database policies, services, routes, and navigation cannot invent aliases:

  - organization: `organization.read`, `organization.manage`, `members.read`, `members.manage`, `roles.manage`, `audit.read`;
  - dashboard/settings: `dashboard.read`, `settings.read`, `settings.manage`;
  - customer/catalog: `customers.read`, `customers.manage`, `catalog.read`, `catalog.manage`;
  - orders/partners: `orders.read`, `orders.create`, `orders.update`, `orders.submit`, `orders.accept`, `orders.manage`, `partners.read`, `partners.manage`;
  - production: `production.read`, `production.plan`, `production.assign`, `production.report.self`, `production.review`, `production.manage`;
  - wages/finance: `wages.read.self`, `wages.read.all`, `wages.manage`, `wages.settle`, `finance.read`, `finance.manage`;
  - shipping/files: `shipping.read`, `shipping.manage`, `attachments.read`, `attachments.manage`;
  - internal work: `tasks.read`, `tasks.manage`, `notifications.read`, `notifications.manage`.

  Create these system role codes and grants:

  - `enterprise_owner`: every catalog permission;
  - `enterprise_admin`: every permission except `audit.read` and `wages.settle`;
  - `order_manager`: `dashboard.read`, `customers.read`, `customers.manage`, `catalog.read`, all `orders.*`, `partners.read`, `production.read`, `shipping.read`, both `attachments.*`, both `tasks.*`, `notifications.read`;
  - `production_manager`: `dashboard.read`, `organization.read`, `members.read`, `catalog.read`, `orders.read`, all `production.*`, `wages.read.all`, `wages.manage`, `shipping.read`, both `attachments.*`, both `tasks.*`, `notifications.read`;
  - `worker`: `production.read`, `production.report.self`, `wages.read.self`, `attachments.read`, `tasks.read`, `notifications.read`;
  - `quality_inspector`: `production.read`, `production.review`, `attachments.read`, `tasks.read`, `notifications.read`;
  - `finance`: `dashboard.read`, `orders.read`, `wages.read.all`, `wages.manage`, `wages.settle`, `finance.read`, `finance.manage`, `shipping.read`, `attachments.read`, `notifications.read`;
  - `warehouse`: `dashboard.read`, `orders.read`, `production.read`, `shipping.read`, `shipping.manage`, `attachments.read`, `tasks.read`, `notifications.read`;
  - `dealer_operator`: `dashboard.read`, `customers.read`, `customers.manage`, `catalog.read`, `orders.read`, `orders.create`, `orders.update`, `orders.submit`, `partners.read`, `shipping.read`, both `attachments.*`, both `tasks.*`, `notifications.read`;
  - `supplier_operator`: `dashboard.read`, `catalog.read`, `catalog.manage`, `orders.read`, `orders.update`, `orders.accept`, `partners.read`, `shipping.read`, both `attachments.*`, both `tasks.*`, `notifications.read`.

  Store this matrix in both the SQL seed and `src/lib/enterprise/permissions.ts`, with a test that compares the two. For the one-enterprise/one-active-member bootstrap case only, bind that member to `enterprise_owner`; if an enterprise has multiple unbound active members, abort with a diagnostic instead of guessing.

- [ ] **Step 7: Add RLS policies using the existing `app_private.has_permission`, `can_access_site`, and `can_access_workshop` helpers.** Policy shape:

```sql
create policy orders_select on public.orders
for select to authenticated
using (app_private.has_permission(enterprise_id, 'orders.read'));

create policy orders_insert on public.orders
for insert to authenticated
with check (app_private.has_permission(enterprise_id, 'orders.create'));
```

Use operation-specific codes; do not grant all access to every active member.

- [ ] **Step 8: Add the three advisor covering indexes:**

```sql
create index if not exists audit_events_membership_actor_idx
  on public.audit_events (tenant_id, membership_id, actor_id);
create index if not exists role_binding_sites_binding_scope_idx
  on public.role_binding_sites (tenant_id, binding_id, scope_kind);
create index if not exists role_binding_workshops_binding_scope_idx
  on public.role_binding_workshops (tenant_id, binding_id, scope_kind);
```

Do not delete currently unused indexes; the production data volume is too small to justify that conclusion.

- [ ] **Step 9: Update Drizzle declarations and relations to exactly match the migrations.** Replace legacy `tenant_id` fields on ERP business rows with `enterprise_id`; keep `tenant_id` only in the immutable v2 IAM schema.

- [ ] **Step 10: Run clean-database and preserved-baseline rehearsals.**

Run: `pnpm db:reset && pnpm db:test && pnpm db:lint && pnpm db:types && pnpm ts-check`

Expected: pgTAP passes, advisor index warnings disappear locally, and no migration drops v2 rows.

- [ ] **Step 11: Commit.**

```bash
git add supabase/migrations supabase/tests src/db
git commit -m "feat: add enterprise-scoped ERP data foundation"
```

---

### Task 4: Introduce request-scoped Supabase SSR clients and session-refresh Proxy

**Files:**

- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `src/lib/supabase/browser.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/proxy.ts`
- Create: `src/lib/supabase/admin.ts`
- Create: `src/proxy.ts`
- Modify: `src/db/client.ts`
- Test: `src/__tests__/supabase-ssr.test.ts`

- [ ] **Step 1: Add failing tests proving that server clients are request scoped, cookie reads/writes are forwarded, the admin client requires `SUPABASE_SECRET_KEY`, and protected requests call `auth.getClaims()` rather than trusting `getSession()`.**

- [ ] **Step 2: Install the exact SSR package:** `pnpm add @supabase/ssr@0.12.4`.

- [ ] **Step 3: Implement browser and server client factories using generated `Database` types.** The server factory must call `cookies()` per request and use `getAll`/`setAll`; it must never cache a client globally.

- [ ] **Step 4: Move the Secret Key client to `src/lib/supabase/admin.ts`, add `import 'server-only'`, disable session persistence, and stop exporting it from the general database client module.**

- [ ] **Step 5: Implement `src/lib/supabase/proxy.ts` following the current official Supabase SSR contract:** create a new client for each request, copy refreshed cookies to both request and response, copy cache-control headers, and immediately call `supabase.auth.getClaims()`.

- [ ] **Step 6: Implement `src/proxy.ts` with a matcher that excludes Next static/image assets and ordinary public files.** Public paths are limited to `/login`, `/auth/confirm`, `/auth/error`, and the explicit public Auth API allowlist. Unauthenticated HTML requests redirect to `/login`; unauthenticated API requests return the standard 401 envelope created in Task 8 (until then, a minimal equivalent shape).

- [ ] **Step 7: Reduce `src/db/client.ts` to environment validation plus deprecated compatibility exports, then migrate all new code to the SSR factories.** Remove runtime `dotenv` loading from application bundles; Next and scripts own environment loading.

- [ ] **Step 8: Run `pnpm test src/__tests__/supabase-ssr.test.ts && pnpm ts-check`.**

- [ ] **Step 9: Commit.**

```bash
git add package.json pnpm-lock.yaml src/lib/supabase src/proxy.ts src/db/client.ts src/__tests__/supabase-ssr.test.ts
git commit -m "feat: add Supabase SSR session infrastructure"
```

---

### Task 5: Replace process-memory authentication with Supabase Auth

**Files:**

- Replace: `src/lib/auth.ts`
- Create: `src/lib/auth/schemas.ts`
- Create: `src/lib/auth/service.ts`
- Modify: `src/app/api/auth/login/route.ts`
- Modify: `src/app/api/auth/logout/route.ts`
- Modify: `src/app/api/auth/register/route.ts`
- Modify: `src/app/api/auth/forgot-password/route.ts`
- Modify: `src/app/api/auth/reset-password/route.ts`
- Modify: `src/app/api/auth/email/send/route.ts`
- Modify: `src/app/api/auth/email/verify/route.ts`
- Modify: `src/app/api/auth/sms/send/route.ts`
- Modify: `src/app/api/auth/sms/verify/route.ts`
- Replace: `src/app/api/auth/oauth/[provider]/route.ts`
- Replace: `src/app/api/auth/oauth/[provider]/callback/route.ts`
- Create: `src/app/auth/confirm/route.ts`
- Create: `src/app/auth/error/page.tsx`
- Modify: `src/app/login/page.tsx`
- Delete after callers are migrated: `src/app/api/auth/captcha/route.ts`
- Test: `src/__tests__/auth-service.test.ts`
- Test: `src/__tests__/auth-routes.test.ts`

- [ ] **Step 1: Add failing tests for email/phone password login, logout, signup, duplicate identity, inactive membership, password reset, OAuth allowlisting, safe redirect validation, and Supabase service outage mapping.** Assert that no custom password hash, in-memory Map, demo account, custom reset token, or custom OAuth state remains.

- [ ] **Step 2: Define Zod request schemas and a single `AuthService`.** Login delegates to `supabase.auth.signInWithPassword`; registration delegates to `supabase.auth.signUp`; password reset delegates to `resetPasswordForEmail`/OTP; OAuth delegates to `signInWithOAuth` and the Supabase callback exchange.

- [ ] **Step 3: Replace the `auth_session` cookie with Supabase's SSR cookies.** Logout calls `supabase.auth.signOut()`. `getCurrentAuthUser()` returns verified claims plus the enterprise context from Task 6; it never reads a global session Map.

- [ ] **Step 4: Remove custom Captcha storage and the visual-captcha dependency from the login page.** Keep abuse protection through Supabase Auth limits and the durable route limits in Task 9. If CAPTCHA is required before production, enable Supabase's supported CAPTCHA provider and pass its token; do not recreate server-memory CAPTCHA.

- [ ] **Step 5: Make enterprise onboarding atomic.** After identity verification, call an authenticated database function that creates `enterprises`, the active owner membership, standard roles, and initial owner binding in one transaction. Never insert `auth.users` or store passwords in public tables.

- [ ] **Step 6: Add a legacy-user activation path.** Generate a non-sensitive report of legacy identities, invite/reset them through Supabase Auth, store stable old-to-new UUID mappings, and leave legacy password columns read-only until migration acceptance. Do not copy custom hashes into Auth.

- [ ] **Step 7: Configure external Auth settings as a documented manual gate:** Site URL `https://qingya-erp-163.netlify.app`, exact localhost/preview redirect allowlist, selected email/phone/OAuth providers, production `SKIP_CAPTCHA` absent, and leaked-password protection enabled. Record no provider secrets in the repository.

- [ ] **Step 8: Run focused and regression tests.**

Run: `pnpm test src/__tests__/auth-service.test.ts src/__tests__/auth-routes.test.ts src/__tests__/login-page-suspense.test.tsx && pnpm ts-check`

- [ ] **Step 9: Commit.**

```bash
git add src/lib/auth.ts src/lib/auth src/app/api/auth src/app/auth src/app/login src/__tests__
git commit -m "feat: migrate authentication to Supabase Auth"
```

---

### Task 6: Make enterprise selection and RBAC authoritative

**Files:**

- Create: `src/lib/enterprise/context.ts`
- Create: `src/lib/enterprise/permissions.ts`
- Create: `src/lib/enterprise/errors.ts`
- Modify: `src/lib/role-access.ts`
- Modify: `src/lib/organization.ts`
- Replace: `src/app/api/organizations/route.ts`
- Modify: `src/components/protected-app-shell.tsx`
- Modify: `src/components/sidebar.tsx`
- Test: `src/__tests__/enterprise-context.test.ts`
- Modify: `src/__tests__/role-access.test.ts`

- [ ] **Step 1: Add failing tests for no membership, suspended membership, one membership defaulting, multiple memberships requiring selection, tampered cookie, enterprise switching, site/workshop scope, and permission-driven navigation.**

- [ ] **Step 2: Define the authoritative context.**

```ts
export interface EnterpriseContext {
  userId: string;
  enterpriseId: EnterpriseId;
  membershipId: string;
  displayName: string;
  grants: ReadonlySet<PermissionCode>;
  siteIds: ReadonlySet<string>;
  workshopIds: ReadonlySet<string>;
}
```

- [ ] **Step 3: Resolve context by verified claim subject plus `enterprise_memberships`.** Treat the `erp_active_enterprise` HttpOnly cookie as a requested ID only. Validate it through `authorize_enterprise_selection`; load grants through `current_enterprise_grants`; reject suspended enterprises or memberships.

- [ ] **Step 4: Replace hard-coded role templates as the authorization source.** `src/lib/role-access.ts` may retain labels/navigation metadata, but access decisions use permission codes returned by v2 RBAC. Add a typed `requirePermission(context, code)` used by server code.

- [ ] **Step 5: Rewrite `/api/organizations` against `enterprises` and `enterprise_memberships`.** GET returns permitted enterprises. POST validates `{ enterpriseId, idempotencyKey }`, calls `authorize_enterprise_selection`, and only then sets the active-enterprise cookie.

- [ ] **Step 6: Update the protected shell and sidebar.** No identity redirects to `/login`; missing selection redirects to an enterprise chooser; permission denial renders `/403`; navigation is filtered from the same permission catalog used by server checks.

- [ ] **Step 7: Run `pnpm test src/__tests__/enterprise-context.test.ts src/__tests__/role-access.test.ts && pnpm ts-check`.**

- [ ] **Step 8: Commit.**

```bash
git add src/lib/enterprise src/lib/role-access.ts src/lib/organization.ts src/app/api/organizations src/components src/__tests__
git commit -m "feat: enforce enterprise membership and RBAC context"
```

---

### Task 7: Add the uniform API contract, request IDs, safe errors, and validation helpers

**Files:**

- Create: `src/lib/api/errors.ts`
- Create: `src/lib/api/response.ts`
- Create: `src/lib/api/request.ts`
- Create: `src/lib/api/handler.ts`
- Create: `src/lib/observability/logger.ts`
- Create: `src/lib/observability/redact.ts`
- Create: `src/__tests__/api-contract.test.ts`
- Create: `src/__tests__/logger-redaction.test.ts`

- [ ] **Step 1: Add failing tests for success, Zod body/query/path errors, 401, 403, 404, 409, 422, 429, unknown exceptions, request ID propagation, and secret redaction.**

- [ ] **Step 2: Define one error class and envelope.**

```ts
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId: string;
    fieldErrors?: Record<string, string[]>;
  };
}

export interface ApiSuccessBody<T> {
  data: T;
  meta?: Record<string, unknown>;
}
```

- [ ] **Step 3: Implement `parseJson`, `parseQuery`, and `parseParams` with Zod.** Empty/invalid JSON maps to `INVALID_JSON`; validation failures map to `VALIDATION_FAILED` without exposing internals.

- [ ] **Step 4: Implement `withApiHandler`.** It creates/propagates `x-request-id`, resolves Auth/enterprise context when required, catches known domain errors, logs unknown errors in structured JSON, and always returns the stable envelope.

- [ ] **Step 5: Redact keys matching `password`, `cookie`, `authorization`, `token`, `secret`, `captcha`, and Supabase credential names recursively.** The client gets a generic `INTERNAL_ERROR`; only server logs contain the sanitized exception class/stack.

- [ ] **Step 6: Run `pnpm test src/__tests__/api-contract.test.ts src/__tests__/logger-redaction.test.ts && pnpm ts-check`.**

- [ ] **Step 7: Commit.**

```bash
git add src/lib/api src/lib/observability src/__tests__/api-contract.test.ts src/__tests__/logger-redaction.test.ts
git commit -m "feat: standardize API validation and error handling"
```

---

### Task 8: Put every API route behind an explicit public/protected policy and migrate unsafe access

**Files:**

- Create: `src/lib/api/route-policy.ts`
- Create: `src/__tests__/api-route-policy.test.ts`
- Modify: `src/app/api/**/*.ts` (all route handlers; migrate in the batches below)
- Modify: `src/app/actions/categories.ts`
- Modify: `src/app/actions/tasks.ts`

- [ ] **Step 1: Add a failing filesystem contract test.** It enumerates every `src/app/api/**/route.ts` and requires an exact entry in a policy manifest. The only anonymous routes are the required Auth initiation/callback endpoints; `/api/debug/**`, `/api/test/**`, and `/api/ppt-fetch` are never publicly enabled in production.

- [ ] **Step 2: Add a second failing scan that rejects raw `request.json()` in mutation handlers and direct service-client imports outside the approved admin/rate-limit modules.** Allow parsed bodies only through `parseJson(schema)`.

- [ ] **Step 3: Migrate batch A — identity and administration:** `organizations`, `organization-requests`, `settings`, `roles`, `permissions`, `departments`, `positions`, `employees`, `workers`. Replace `tenant_id` request input with the resolved `context.enterpriseId`; require explicit permissions; use the SSR user client so RLS remains active.

- [ ] **Step 4: Migrate batch B — internal work:** `categories`, `tasks`, `notifications`, `dashboard`, `customers`, `products`. Add Zod schemas, enterprise filters, typed DTOs, and stable envelopes. This removes the deployed 500s caused by missing tables without granting anonymous access.

- [ ] **Step 5: Migrate batch C — partner and order access:** `dealer`, `supplier`, `orders`, `order-exchanges`, `order-partners`, `spaces`, `factories`, `factory`. Enforce resource-enterprise membership and partner-specific DTO filtering; never expose cost, profit, wages, internal notes, or worker identities to dealer/supplier roles.

- [ ] **Step 6: Migrate batch D — production and money:** `production`, `progress`, `worker`, `performance`, `wage-records`, `wage-rules`, `wages`, `finance`. Require operation-specific permissions, user ownership for worker endpoints, idempotency keys for mutations, and status-conflict responses. Full workflow behavior remains Phase 2; Phase 1 establishes safe boundaries.

- [ ] **Step 7: Remove or production-disable diagnostic surfaces.** Delete `/api/test/db`; make `/api/debug/**` return 404 unless `NODE_ENV === 'development'`; either remove `/api/ppt-fetch` or require a documented permission and strict URL allowlist.

- [ ] **Step 8: Update Server Actions to call the same service/authorization layer, not bypass route policy.**

- [ ] **Step 9: Run the route-policy test after each batch and the full API-related suite after all batches.**

Run: `pnpm test src/__tests__/api-route-policy.test.ts && pnpm test && pnpm ts-check`

Expected: every route is classified; no unvalidated mutation body or unauthorized admin client remains.

- [ ] **Step 10: Commit each batch separately:**

```bash
git commit -m "refactor: secure identity and admin APIs"
git commit -m "refactor: secure internal work APIs"
git commit -m "refactor: secure partner and order APIs"
git commit -m "refactor: secure production and finance APIs"
```

---

### Task 9: Add durable rate limiting for authentication, uploads, and sensitive mutations

**Files:**

- Create: `supabase/migrations/20260823093000_api_rate_limits.sql`
- Create: `supabase/tests/api_rate_limits.test.sql`
- Create: `src/lib/security/rate-limit.ts`
- Modify: `src/lib/api/handler.ts`
- Modify: Auth and upload route handlers from Tasks 5 and 8
- Test: `src/__tests__/rate-limit.test.ts`

- [ ] **Step 1: Add failing pgTAP and Vitest tests for atomic consumption, window rollover, concurrent attempts, 429 response shape, `Retry-After`, IPv4/IPv6 normalization, and hashed identifiers.**

- [ ] **Step 2: Create `app_private.api_rate_limit_buckets` and an atomic `app_private.consume_rate_limit(...)` function.** Expose a narrow public wrapper executable only by `service_role`; revoke table/function access from `public`, `anon`, and `authenticated`; set an explicit safe `search_path`.

- [ ] **Step 3: Implement a server-only adapter that hashes `route + normalized client identifier` with `RATE_LIMIT_PEPPER`.** Never store raw IP, email, or phone. Trust forwarded IP headers only on documented Netlify infrastructure.

- [ ] **Step 4: Apply limits:** login 10/15 minutes/IP+account, signup 5/hour/IP, password reset 5/hour/account, OTP send 5/hour/destination, enterprise switch 30/minute/user, uploads 30/hour/user, and critical mutations 120/minute/user. Supabase Auth provider limits remain an additional layer.

- [ ] **Step 5: Run `pnpm db:reset && pnpm db:test && pnpm test src/__tests__/rate-limit.test.ts`.**

- [ ] **Step 6: Commit.**

```bash
git add supabase/migrations supabase/tests src/lib/security src/lib/api/handler.ts src/app/api src/__tests__/rate-limit.test.ts
git commit -m "feat: add durable API rate limiting"
```

---

### Task 10: Add security headers, strict image origins, error boundaries, and safe production diagnostics

**Files:**

- Modify: `src/proxy.ts`
- Modify: `next.config.ts`
- Create: `src/app/error.tsx`
- Create: `src/app/global-error.tsx`
- Create: `src/app/not-found.tsx`
- Create: `src/app/401/page.tsx`
- Create: `src/app/403/page.tsx`
- Create: `src/components/error-state.tsx`
- Modify: `src/app/(dashboard)/layout.tsx`
- Modify: other garbled layout/API strings found by `rg`
- Test: `src/__tests__/security-headers.test.ts`
- Test: `src/__tests__/error-pages.test.tsx`

- [ ] **Step 1: Add failing tests for CSP, clickjacking protection, MIME sniffing protection, referrer policy, permissions policy, `x-powered-by` removal, image origin allowlisting, request ID display, retry behavior, 401/403/not-found pages, and valid Chinese labels.**

- [ ] **Step 2: Generate a per-request nonce in Proxy and set one CSP on both request and response.** Production `script-src` uses the nonce and `strict-dynamic`; development alone may add `unsafe-eval`. Keep `style-src 'unsafe-inline'` only as required by current UI inline styles. Set `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, and explicit `connect-src` for the configured Supabase origin.

- [ ] **Step 3: Add static headers:** `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a minimal `Permissions-Policy`, and `Cross-Origin-Opener-Policy: same-origin`. Preserve Netlify HSTS.

- [ ] **Step 4: Set `poweredByHeader: false` and replace the wildcard image hostname with explicit configured Supabase Storage and approved asset domains.** An empty allowlist is preferable until a real remote image origin is needed.

- [ ] **Step 5: Add error pages and reusable states.** Unknown errors show the request ID and retry action, never a stack or backend message. Permission denial is a true 403 state rather than a query-string toast on another page.

- [ ] **Step 6: Fix known mojibake and `????` strings in protected layouts/settings APIs.** Add a UTF-8 scan test so replacement-character and question-mark placeholders cannot return.

- [ ] **Step 7: Run `pnpm test src/__tests__/security-headers.test.ts src/__tests__/error-pages.test.tsx && pnpm ts-check`.**

- [ ] **Step 8: Commit.**

```bash
git add src/proxy.ts next.config.ts src/app src/components/error-state.tsx src/__tests__
git commit -m "feat: harden web responses and error states"
```

---

### Task 11: Simplify the build and add enforceable CI/Netlify deployment gates

**Files:**

- Modify: `package.json`
- Modify: `scripts/build.sh` or delete after callers are updated
- Modify: `scripts/dev.sh`
- Modify: `scripts/start.sh`
- Delete: `src/server.ts` after verifying no supported deployment uses it
- Create: `netlify.toml`
- Create: `.github/workflows/ci.yml`
- Modify: `.env.example`
- Modify: `README.md`
- Test: `src/__tests__/deployment-config.test.ts`

- [ ] **Step 1: Add a failing configuration test asserting:** build is `next build`; preinstall is `only-allow pnpm`; no build-time `pnpm install`; no `tsup src/server.ts`; Netlify uses `pnpm build` and `.next`; CI runs lint with zero warnings, typecheck, tests, database reset/tests/lint, generated-type drift, and production build.

- [ ] **Step 2: Normalize scripts.**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "preinstall": "only-allow pnpm",
    "lint": "eslint . --max-warnings 0",
    "validate": "pnpm lint && pnpm ts-check && pnpm test && pnpm build"
  }
}
```

- [ ] **Step 3: Add `netlify.toml`.** Pin Node 20 and pnpm 9, command `pnpm build`, publish `.next`, and use the Netlify Next.js Runtime. Do not place environment values in the file.

- [ ] **Step 4: Add CI on pull requests and `main`.** Use pnpm's frozen lockfile; start local Supabase; reset and run pgTAP/lint; generate local types and verify no diff; run application validation; build using local non-production credentials. The workflow must never receive production `SUPABASE_SECRET_KEY`.

- [ ] **Step 5: Update `.env.example`.** Include only names and safe comments: Supabase URL, publishable key, server secret, app URL, rate-limit pepper, and optional approved image origin. Explicitly state `APP_URL=https://qingya-erp-163.netlify.app` for production documentation, not as a committed secret.

- [ ] **Step 6: Document Netlify context separation.** Production uses production Supabase; Deploy Previews must use a local/branch/staging Supabase project and fail closed if preview variables point at production project `jfcsbwdawvsxnmovwlgl`.

- [ ] **Step 7: Run `pnpm test src/__tests__/deployment-config.test.ts && pnpm validate`.**

- [ ] **Step 8: Commit.**

```bash
git add package.json pnpm-lock.yaml scripts src/server.ts netlify.toml .github/workflows/ci.yml .env.example README.md src/__tests__/deployment-config.test.ts
git commit -m "ci: enforce production build and database gates"
```

---

### Task 12: Eliminate lint warnings and add phase-one regression coverage

**Files:**

- Modify: files reported by `pnpm lint`
- Modify: `vitest.config.ts`
- Create: `src/__tests__/cross-enterprise-access.test.ts`
- Create: `src/__tests__/protected-shell.test.tsx`
- Create: `src/__tests__/production-safety.test.ts`

- [ ] **Step 1: Snapshot the current 12 warnings and create focused behavior tests before changing hook dependencies or removing variables.** Do not suppress `react-hooks/exhaustive-deps` globally.

- [ ] **Step 2: Fix each warning at its source.** Stabilize callbacks, derive values instead of synchronizing redundant state, and remove genuinely unused imports/variables.

- [ ] **Step 3: Add cross-enterprise request tests using two users and two enterprises.** Cover direct-ID probing, list filters, inserts with forged `enterprise_id`, worker self-only endpoints, partner DTO redaction, and unauthorized enterprise-cookie changes.

- [ ] **Step 4: Add a production-safety source scan.** Fail if production code contains global Auth/session Maps, demo passwords, plaintext password columns in new schema, raw Secret Key imports, open image wildcard hosts, public debug routes, or `SKIP_CAPTCHA=1` defaults.

- [ ] **Step 5: Run the entire local gate twice, once after a clean database reset.**

Run:

```bash
pnpm db:reset
pnpm db:test
pnpm db:lint
pnpm lint
pnpm ts-check
pnpm test
pnpm build
```

Expected: zero warnings, all application and database tests pass, and the production build succeeds.

- [ ] **Step 6: Commit.**

```bash
git add src vitest.config.ts
git commit -m "test: complete production safety regression suite"
```

---

### Task 13: Rehearse migration with preserved v2 data and produce the rollback/runbook evidence

**Files:**

- Create: `docs/runbooks/phase-1-migration.md`
- Create: `docs/runbooks/phase-1-rollback.md`
- Create: `docs/review/phase-1-verification.md`
- Create: `scripts/verify-production-readiness.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add `pnpm verify:production-readiness` that runs repository tests, migration-history checks, database lint/tests, generated-type drift, and advisor checks against an explicitly selected non-production target.** Make the script refuse production project `jfcsbwdawvsxnmovwlgl` unless `ALLOW_PRODUCTION_READ_ONLY_CHECKS=1`, and never apply migrations.

- [ ] **Step 2: Create a recoverable backup outside the repository.** Require the operator to set an explicit absolute `ERP_BACKUP_DIR`; dump schema, roles/grants, and data; create SHA-256 checksums; verify the dumps can restore to an isolated database. Do not log credentials or place dumps in Git.

- [ ] **Step 3: Restore the production snapshot to an isolated rehearsal database, mark the same five v2 migration versions as the starting history, then apply every new migration.** Verify the pre-existing enterprise, membership, idempotency, audit, and security-event row counts and IDs are unchanged.

- [ ] **Step 4: Run the full test gate against both:** (a) a clean database built only from migrations and (b) the restored v2 snapshot upgraded in place.

- [ ] **Step 5: Write a forward-only rollback runbook.** Because additive schema migrations are preferred, rollback means deploy the prior app, disable new entry points, and apply a reviewed compensating migration only if necessary. Never use `supabase db reset`, destructive `DROP ... CASCADE`, or restore-over-production as a casual rollback.

- [ ] **Step 6: Record evidence:** migration list, schema diff summary, pgTAP output, advisor results, lint/type/test/build outputs, Auth flow results, cross-enterprise denials, and backup checksum location. Redact all secrets and personal data.

- [ ] **Step 7: Commit.**

```bash
git add docs/runbooks docs/review/phase-1-verification.md scripts/verify-production-readiness.mjs package.json
git commit -m "docs: add phase one migration and rollback runbooks"
```

---

### Task 14: Human checkpoint, production rollout, and post-deploy verification

This task is intentionally gated. Reaching it does not authorize production changes, Git push/merge, or Netlify deployment.

- [ ] **Step 1: Request review of the branch diff and the Task 13 evidence.** Review specifically for destructive SQL, grants/RLS, Secret Key use, Auth redirect URLs, preview-environment isolation, and preservation of v2 rows.

- [ ] **Step 2: Obtain explicit user authorization for each external action:** push/PR, production backup, production migration, Supabase Auth setting changes, Netlify environment changes, and production deploy.

- [ ] **Step 3: Apply only reviewed migrations through the Supabase migration mechanism.** Do not run legacy `scripts/init-*.sql` or manual dashboard SQL.

- [ ] **Step 4: Deploy from the approved `xiangzhi2022/erpv1` main flow, allow the `LOVEZHI163/erpv1` mirror to sync, and let Netlify build from the mirror main branch.** Do not develop independently in the mirror.

- [ ] **Step 5: Run production smoke checks with dedicated test identities:** signup/confirmation or approved migrated login, login/logout, token refresh, password reset, enterprise switch, 401/403, cross-enterprise denial, categories/tasks/notifications loading, rate-limit 429, error page/request ID, and security headers.

- [ ] **Step 6: Re-run Supabase security and performance advisors.** Acceptance permits the two documented service-only “RLS enabled, no policy” info items only if grants/function tests prove they are inaccessible; leaked-password protection must be enabled; missing-FK-index warnings introduced or inherited by this phase must be resolved.

- [ ] **Step 7: Mark Phase 1 complete only when every approved-spec acceptance criterion is evidenced.** Open separate implementation plans for Phase 2 core workflow, Phase 3 UI/supporting modules, and Phase 4 release quality; do not fold them into this rollout.

## Phase-one definition of done

- The five v2 migrations and all new migrations reconstruct a clean database and upgrade a preserved v2 snapshot without data loss.
- Supabase Auth/SSR is the only production identity/session mechanism; no process-memory authentication state remains.
- Every protected request uses verified claims, active membership, resource enterprise, permission checks, and RLS.
- Every ERP business table is enterprise scoped with constraints, indexes, grants, and tested RLS.
- Every API route has an explicit policy; mutation inputs use Zod; responses use one stable envelope with request IDs.
- Rate limits, security headers, strict image origins, safe logging, error pages, and disabled production diagnostics are verified.
- CI passes with frozen pnpm dependencies, zero ESLint warnings, TypeScript, Vitest, pgTAP, database lint/type drift, and Next.js production build.
- Production rollout evidence and rollback instructions exist, and no external mutation occurs without explicit authorization.
