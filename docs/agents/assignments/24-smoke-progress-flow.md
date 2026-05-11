# Task 24: Smoke Fix - Production Progress Create and Report Flow

Suggested branch: `codex/smoke-progress-flow`

Suggested worker: `backend-agent`

## Task Goal

Fix the production progress write blockers found during smoke testing so work orders can be created and progress can be reported from a normal authenticated local session.

Smoke evidence:

- `/progress` page returns 200.
- `GET /api/progress/work-orders` returns 200.
- `GET /api/progress/workshops` returns 200.
- `POST /api/progress/work-orders` fails with `invalid input syntax for type uuid: "2"`.
- `POST /api/progress/report` fails because progress log insert receives demo user id `"2"` for a UUID field.

Reference:

- `docs/review/SMOKE-TEST-RESULTS.md`

## Allowed Files

- `src/app/api/progress/**`
- `src/app/progress/**`
- `src/lib/auth.ts`
- `src/lib/auth-utils.ts`
- `src/db/schema.ts`
- `src/db/relations.ts`
- `DATABASE.md`

## Forbidden Files

- `src/app/api/orders/**`
- `src/app/orders/**`
- `src/app/api/auth/login/**`
- `src/app/supplier/**`
- `src/app/settings/**`
- `src/components/**`
- `package.json`
- `pnpm-lock.yaml`
- `.env`
- `.env.local`

## Requirements

- Ensure progress write paths never insert non-UUID demo ids into UUID database columns.
- Preserve existing progress status names and transitions.
- Keep `GET /api/progress/work-orders` and `GET /api/progress/workshops` response shapes stable.
- Verify work order creation and progress report logging.
- If Task 22 already provides UUID-compatible demo sessions, integrate with that behavior instead of duplicating auth logic.

## Acceptance Criteria

- `POST /api/progress/work-orders` can create a work order for an existing order.
- `POST /api/progress/report` can write a progress log for an existing work order.
- `report_progress` and `warehouse_in` actions behave according to current schema rules.
- No unrelated orders/shell/settings changes.

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
- codex/smoke-progress-flow

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
