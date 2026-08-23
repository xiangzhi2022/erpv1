create type public.membership_status as enum ('invited', 'active', 'suspended');

create type public.org_unit_type as enum ('department', 'team');

create table public.enterprises (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.enterprise_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.enterprises(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.membership_status not null default 'invited',
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id),
  unique (tenant_id, id)
);

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.enterprises(id),
  code text not null,
  name text not null,
  site_type text not null check (site_type in ('headquarters', 'store', 'factory', 'warehouse')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  unique (tenant_id, code),
  unique (tenant_id, id)
);

create table public.org_units (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.enterprises(id),
  site_id uuid,
  parent_id uuid,
  code text not null,
  name text not null,
  unit_type public.org_unit_type not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, code),
  unique (tenant_id, id),
  foreign key (tenant_id, site_id) references public.sites(tenant_id, id),
  foreign key (tenant_id, parent_id) references public.org_units(tenant_id, id)
);

create table public.workshops (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.enterprises(id),
  site_id uuid not null,
  code text not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, code),
  unique (tenant_id, id),
  foreign key (tenant_id, site_id) references public.sites(tenant_id, id)
);

create table public.workstations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.enterprises(id),
  workshop_id uuid not null,
  code text not null,
  name text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  unique (tenant_id, code),
  unique (tenant_id, id),
  foreign key (tenant_id, workshop_id) references public.workshops(tenant_id, id)
);

create index enterprise_memberships_tenant_id_idx
  on public.enterprise_memberships (tenant_id);

create index enterprise_memberships_user_id_idx
  on public.enterprise_memberships (user_id);

create index enterprise_memberships_active_lookup_idx
  on public.enterprise_memberships (tenant_id, user_id)
  where status = 'active';

create index sites_tenant_id_idx
  on public.sites (tenant_id);

create index org_units_tenant_id_idx
  on public.org_units (tenant_id);

create index org_units_tenant_site_id_idx
  on public.org_units (tenant_id, site_id);

create index org_units_tenant_parent_id_idx
  on public.org_units (tenant_id, parent_id);

create index workshops_tenant_id_idx
  on public.workshops (tenant_id);

create index workshops_tenant_site_id_idx
  on public.workshops (tenant_id, site_id);

create index workstations_tenant_id_idx
  on public.workstations (tenant_id);

create index workstations_tenant_workshop_id_idx
  on public.workstations (tenant_id, workshop_id);
