# Task 27: Smoke Regression Verification and Delivery Report

Suggested branch: `codex/smoke-regression-verification`

Suggested worker: `test-agent`

## Task Goal

After Tasks 21-26 are integrated, rerun the smoke scenarios and update the smoke result documentation with the final pass/fail status.

Reference:

- `docs/review/SMOKE-TEST-RESULTS.md`
- `docs/agents/assignments/21-smoke-dashboard-shell.md`
- `docs/agents/assignments/22-smoke-auth-session.md`
- `docs/agents/assignments/23-smoke-orders-flow.md`
- `docs/agents/assignments/24-smoke-progress-flow.md`
- `docs/agents/assignments/25-smoke-portals-routing.md`
- `docs/agents/assignments/26-smoke-tasks-notifications-api.md`

## Allowed Files

- `docs/review/SMOKE-TEST-RESULTS.md`
- `src/__tests__/**`
- `vitest.config.ts`

## Forbidden Files

- `src/app/**`
- `src/components/**`
- `src/db/**`
- `src/lib/**`
- `scripts/**`
- `package.json`
- `pnpm-lock.yaml`
- `.env`
- `.env.local`

## Requirements

- Rerun the documented smoke scenarios after the implementation branches are integrated.
- Update `docs/review/SMOKE-TEST-RESULTS.md` with current results.
- Add or adjust tests only for stable regression coverage that does not require real Supabase network access.
- Do not fix product code in this task.

## Smoke Scenarios

- Login and logout.
- Orders page opens.
- Order creation and status transition.
- Production progress work order creation and progress report.
- Worker, supplier, dealer, settings, dashboard, factory, and portal pages.
- Categories, tasks, and notifications API smoke checks.

## Acceptance Criteria

- Smoke documentation reflects final current status after Tasks 21-26.
- `pnpm test`, `pnpm ts-check`, and `pnpm lint` are run and reported.
- Any remaining failures are documented with root cause and owner task recommendation.

## Validation Commands

```bash
pnpm test
pnpm ts-check
pnpm lint
```

## Delivery Report

Return only:

```text
## Branch
- codex/smoke-regression-verification

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
