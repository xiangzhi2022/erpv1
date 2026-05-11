# Task 22: Smoke Fix - Auth Session Unification

Suggested branch: `codex/smoke-auth-session`

Suggested worker: `backend-agent`

## Task Goal

Unify protected API authentication around the current login session behavior so APIs work after a normal browser login.

Smoke evidence:

- `POST /api/auth/login` succeeds and sets `auth_session`.
- `GET /api/orders` with the normal login cookie returns 401.
- Orders API still reads legacy `erp_user`.
- Demo login user id is `"2"`, which breaks UUID database writes in progress flows.

Reference:

- `docs/review/SMOKE-TEST-RESULTS.md`

## Allowed Files

- `src/app/api/auth/**`
- `src/lib/auth.ts`
- `src/lib/auth-utils.ts`
- `src/app/api/orders/**`
- `src/app/api/progress/**`

## Forbidden Files

- `src/db/schema.ts`
- `src/db/relations.ts`
- `src/app/orders/**`
- `src/app/progress/**`
- `src/app/settings/**`
- `src/components/**`
- `package.json`
- `pnpm-lock.yaml`
- `.env`
- `.env.local`

## Requirements

- Make protected APIs use the same session source produced by `POST /api/auth/login`.
- Preserve the `auth_session` cookie contract.
- Remove or bypass legacy `erp_user` dependency for protected API access.
- Ensure local demo users used for database writes have UUID-compatible ids, or safely map demo sessions to UUID-compatible users.
- Do not introduce persistent sessions or new auth storage unless already supported by existing code.
- Do not commit secrets or environment files.

## Acceptance Criteria

- Login with `13800138000 / demo123` returns `success:true`.
- `GET /api/orders` succeeds with only the normal `auth_session` cookie.
- `GET /api/progress/work-orders` still succeeds with the normal `auth_session` cookie.
- Auth failures still return clear 401 responses when no session cookie exists.
- No frontend UI or database schema changes.

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
- codex/smoke-auth-session

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
