-- Security-definer functions owned by v2_function_owner authenticate callers
-- through auth.uid(). Keep access limited to schema traversal and that single
-- helper; the role receives no auth table privileges.
grant usage on schema auth to v2_function_owner;
grant execute on function auth.uid() to v2_function_owner;
