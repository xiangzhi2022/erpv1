# Task 23: Smoke Fix - Orders Create and Status Flow

Suggested branch: `codex/smoke-orders-flow`

Suggested worker: `backend-agent`

## Task Goal

Fix the order creation blocker found during smoke testing and verify the core order status transition flow.

Smoke evidence:

- `/orders` page returns 200.
- `POST /api/orders` fails with 500.
- Error: `Could not find the 'target_factory_id' column of 'orders' in the schema cache`.
- Order status flow could not be tested on a new order because creation failed.

Reference:

- `docs/review/SMOKE-TEST-RESULTS.md`

## Allowed Files

- `src/app/api/orders/**`
- `src/app/orders/**`
- `src/app/api/customers/**`
- `src/app/api/factories/**`
- `src/db/schema.ts`
- `src/db/relations.ts`
- `scripts/**`
- `DATABASE.md`

## Forbidden Files

- `src/app/api/progress/**`
- `src/app/progress/**`
- `src/app/api/auth/**`
- `src/lib/auth.ts`
- `src/components/**`
- `package.json`
- `pnpm-lock.yaml`
- `.env`
- `.env.local`

## Requirements

- Align order creation with the actual Supabase schema.
- Either remove `target_factory_id` from insert payloads when the column is not part of the supported schema, or add the missing schema/migration documentation if the column is required.
- Keep order API response shape compatible with existing frontend expectations.
- Verify valid status transitions from `pending` through the configured order lifecycle.
- Do not solve auth-session unification here except by relying on the result of Task 22 if present.

## Acceptance Criteria

- A new order can be created locally through `POST /api/orders`.
- The created order includes order items.
- Status transition API works for the supported lifecycle.
- Failure responses are explicit and not generic 500s for known validation errors.
- No unrelated progress/auth/shell changes.

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
- codex/smoke-orders-flow

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
