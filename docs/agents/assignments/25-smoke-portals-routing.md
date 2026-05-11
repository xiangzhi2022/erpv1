# Task 25: Smoke Fix - Factory and Worker Portal Routes

Suggested branch: `codex/smoke-portals-routing`

Suggested worker: `frontend-agent`

## Task Goal

Resolve missing portal routes or navigation mismatches for factory and worker portal entry points.

Smoke evidence:

- `/factory/portal` returns 404.
- `/worker/portal` returns 404.

Reference:

- `docs/review/SMOKE-TEST-RESULTS.md`

## Allowed Files

- `src/app/factory/**`
- `src/app/worker/**`
- `src/app/workers/**`
- `src/components/sidebar.tsx`
- `src/app/(dashboard)/**`

## Forbidden Files

- `src/app/api/**`
- `src/db/**`
- `src/lib/auth.ts`
- `src/app/orders/**`
- `src/app/progress/**`
- `package.json`
- `pnpm-lock.yaml`
- `.env`
- `.env.local`

## Requirements

- Determine the intended existing portal pages and routes from the current app structure.
- Either add lightweight route aliases for `/factory/portal` and `/worker/portal`, or update navigation to the actual existing routes.
- Prefer preserving existing portal UI and behavior over creating duplicate implementations.
- Do not modify backend APIs.

## Acceptance Criteria

- The intended factory portal entry no longer returns 404.
- The intended worker portal entry no longer returns 404.
- Navigation links point to valid routes.
- No unrelated API, database, auth, or lockfile changes.

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
- codex/smoke-portals-routing

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
