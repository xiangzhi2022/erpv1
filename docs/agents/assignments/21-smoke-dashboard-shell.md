# Task 21: Smoke Fix - Dashboard Shell and Sidebar Provider

Suggested branch: `codex/smoke-dashboard-shell`

Suggested worker: `frontend-agent`

## Task Goal

Fix the shell-level runtime errors found in the local smoke test so the affected pages can render without throwing `useSidebar must be used within a SidebarProvider`.

Smoke evidence:

- `/dashboard` returns 500.
- `/supplier` returns 500.
- `/settings` returns 500.
- `/factory` returns 500.
- Runtime error: `useSidebar must be used within a SidebarProvider`.

Reference:

- `docs/review/SMOKE-TEST-RESULTS.md`

## Allowed Files

- `src/app/(dashboard)/**`
- `src/app/dashboard/**`
- `src/app/supplier/**`
- `src/app/settings/**`
- `src/app/factory/**`
- `src/components/sidebar.tsx`
- `src/components/ui/sidebar.tsx`

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

- Ensure every page that renders the shared sidebar is wrapped in the required `SidebarProvider`.
- Keep the current visual shell and navigation behavior as much as possible.
- Do not rewrite business UI or API logic.
- Do not hide the error by catching it; fix the provider/layout boundary.
- Confirm `/dashboard`, `/supplier`, `/settings`, and `/factory` render with HTTP 200 locally.

## Acceptance Criteria

- `/dashboard` no longer throws `useSidebar must be used within a SidebarProvider`.
- `/supplier` no longer throws `useSidebar must be used within a SidebarProvider`.
- `/settings` no longer throws `useSidebar must be used within a SidebarProvider`.
- `/factory` no longer throws `useSidebar must be used within a SidebarProvider`.
- No unrelated API, database, lockfile, or environment changes.

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
- codex/smoke-dashboard-shell

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
