-- Security-definer RPCs need the privileges implied by their SQL statements:
-- SELECT ... FOR UPDATE also requires UPDATE, and INSERT ... RETURNING requires
-- SELECT on the returned columns. Keep these grants on the dedicated NOLOGIN
-- owner instead of restoring direct component or audit-log writes to callers.
grant update on table public.order_modules to v2_function_owner;
grant select on table public.progress_logs to v2_function_owner;
