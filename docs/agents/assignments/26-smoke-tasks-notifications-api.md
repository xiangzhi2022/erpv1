# Task 26: Smoke Fix - Tasks, Categories, and Notifications APIs

Suggested branch: `codex/smoke-tasks-notifications-api`

Suggested worker: `backend-agent`

## Task Goal

Investigate and fix the 500 errors found in tasks, categories, and notifications APIs during local smoke testing.

Smoke evidence:

- `GET /api/categories` returns 500.
- `GET /api/tasks` returns 500.
- `GET /api/notifications` returns 500.

Reference:

- `docs/review/SMOKE-TEST-RESULTS.md`

## Allowed Files

- `src/app/api/categories/**`
- `src/app/api/tasks/**`
- `src/app/api/notifications/**`
- `src/app/tasks/**`
- `src/app/(dashboard)/categories/**`
- `src/db/schema.ts`
- `src/db/relations.ts`
- `DATABASE.md`

## Forbidden Files

- `src/app/api/orders/**`
- `src/app/api/progress/**`
- `src/app/api/auth/**`
- `src/lib/auth.ts`
- `src/components/**`
- `package.json`
- `pnpm-lock.yaml`
- `.env`
- `.env.local`

## Requirements

- Identify the exact cause of each 500 before changing behavior.
- Align API queries and payloads with the current database schema.
- Preserve existing response shapes expected by frontend consumers.
- Do not broaden scope into orders, progress, auth, or shell fixes.

## Acceptance Criteria

- `GET /api/categories` returns 200 or a clear non-500 auth/validation response.
- `GET /api/tasks` returns 200 or a clear non-500 auth/validation response.
- `GET /api/notifications` returns 200 or a clear non-500 auth/validation response.
- Existing task/category/notification tests still pass.

## Validation Commands

```bash
pnpm ts-check
pnpm test
pnpm lint
```

## Delivery Report

Return only:

```text
## Branch
- codex/smoke-tasks-notifications-api

## Modified Files
- ...

## Implementation Notes
- ...

## Validation
- Ran: ...
- Not run and why: ...

## Risks
- ...
```
