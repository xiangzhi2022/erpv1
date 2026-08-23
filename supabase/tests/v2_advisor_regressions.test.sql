begin;

select plan(3);

select has_index(
  'public',
  'audit_events',
  'audit_events_membership_actor_idx',
  'audit membership composite foreign key has a covering index'
);

select has_index(
  'public',
  'role_binding_sites',
  'role_binding_sites_binding_scope_idx',
  'site binding composite foreign key has a covering index'
);

select has_index(
  'public',
  'role_binding_workshops',
  'role_binding_workshops_binding_scope_idx',
  'workshop binding composite foreign key has a covering index'
);

select * from finish();

rollback;
