# Local Smoke Test Results

## Summary

This document records the local smoke test run for the ERP application after local startup and environment setup. It is intended as a verification record and follow-up fix list.

No business code changes were made as part of this document.

## Environment

| Item | Value |
| --- | --- |
| Local URL | `http://localhost:5000` |
| OS / Shell | Windows PowerShell + Git Bash startup script |
| Startup script | `start-local.sh` |
| Package manager | `pnpm` |
| Database config | Supabase via `.env` |
| Test mode | Manual smoke test |

## Environment Fixes Recorded

The local `.env` was aligned with the project-expected variable names:

```text
COZE_SUPABASE_URL
COZE_SUPABASE_ANON_KEY
COZE_SUPABASE_SERVICE_ROLE_KEY
SKIP_CAPTCHA=1
```

Additional local startup fix:

- Removed UTF-8 BOM from `.env` because Git Bash treated the first line as an invalid command.
- Confirmed the local server starts on `http://localhost:5000`.
- Confirmed `SKIP_CAPTCHA=1` is present for local development login.

## Auth Smoke Results

| Scenario | Result | Notes |
| --- | --- | --- |
| Login API | PASS | `POST /api/auth/login` returned `success:true`. |
| Logout API | PASS | `POST /api/auth/logout` returned `success:true`. |
| Browser login | PARTIAL | Login works with demo credentials, but captcha input must still contain a value on the frontend. |
| Post-login redirect | FAIL | Login lands on `/`, which shows an "application under development" placeholder instead of the actual dashboard. |

Local demo credentials used:

```text
Account: 13800138000
Password: demo123
Captcha: 0000
```

## Core Page Smoke Results

| Page | Result | Notes |
| --- | --- | --- |
| `/` | PARTIAL | Opens, but shows placeholder content instead of ERP dashboard. |
| `/login` | PASS | Login page opens. |
| `/orders` | PASS | Orders page returns 200. |
| `/progress` | PASS | Production progress page returns 200. |
| `/worker` | PASS | Worker page returns 200. |
| `/dealer` | PASS | Dealer page returns 200. |
| `/dashboard` | FAIL | 500: `useSidebar must be used within a SidebarProvider`. |
| `/supplier` | FAIL | 500: `useSidebar must be used within a SidebarProvider`. |
| `/settings` | FAIL | 500: `useSidebar must be used within a SidebarProvider`. |
| `/factory` | FAIL | 500: `useSidebar must be used within a SidebarProvider`. |
| `/factory/portal` | FAIL | 404 route not found. |
| `/worker/portal` | FAIL | 404 route not found. |

## API Smoke Results

| API | Result | Notes |
| --- | --- | --- |
| `POST /api/auth/login` | PASS | Returns `success:true` and sets `auth_session`. |
| `POST /api/auth/logout` | PASS | Returns `success:true`. |
| `GET /api/progress/work-orders` | PASS | Returns 200 with work order data. |
| `GET /api/progress/workshops` | PASS | Returns 200 with workshop data. |
| `GET /api/orders` with normal login cookie | FAIL | 401. Login writes `auth_session`, while orders API reads legacy `erp_user`. |
| `POST /api/orders` | FAIL | 500: missing `orders.target_factory_id` column in current Supabase schema cache. |
| `POST /api/progress/work-orders` | FAIL | 500: `invalid input syntax for type uuid: "2"`. |
| `POST /api/progress/report` | FAIL | 500: progress log insert fails because demo user id `"2"` is not a UUID. |
| `GET /api/categories` | FAIL | 500. |
| `GET /api/tasks` | FAIL | 500. |
| `GET /api/notifications` | FAIL | 500. |

## Confirmed Blockers

1. Missing `SidebarProvider`
   - Affects `/dashboard`, `/supplier`, `/settings`, and `/factory`.
   - Runtime error: `useSidebar must be used within a SidebarProvider`.

2. Inconsistent auth cookie usage
   - Login writes `auth_session`.
   - Some order APIs still read `erp_user`.
   - Result: authenticated browser session can still receive 401 from order APIs.

3. Database schema mismatch for order creation
   - Order creation attempts to insert `target_factory_id`.
   - Current Supabase schema cache does not contain `orders.target_factory_id`.
   - Result: order creation fails with 500.

4. Demo user id is incompatible with UUID columns
   - Demo login user id is `"2"`.
   - Progress write paths insert this value into UUID fields such as `created_by` or `operator_id`.
   - Result: work order creation and progress report logging fail.

5. Post-login route target is not a real ERP dashboard
   - Login redirects to `/`.
   - `/` currently shows placeholder content.

6. Missing portal routes
   - `/factory/portal` returns 404.
   - `/worker/portal` returns 404.

## Recommended Fix Priority

1. Fix dashboard shell usage by wrapping affected pages with `SidebarProvider`.
2. Unify authentication for protected APIs around `auth_session` / `getUserFromRequest`.
3. Align order creation with the real Supabase schema or add the missing `orders.target_factory_id` migration.
4. Use a UUID-compatible local demo user id or map demo sessions to a real Supabase user id for database writes.
5. Change post-login redirect from `/` to the actual ERP dashboard route.
6. Decide the intended URLs for factory and worker portals, then either add routes or update navigation links.
7. Investigate `/api/categories`, `/api/tasks`, and `/api/notifications` 500 errors after auth/schema blockers are resolved.

## Notes

- This is a local smoke test result document only.
- It does not include code fixes.
- It does not include git commit or branch operations.
