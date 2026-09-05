create type public.member_role as enum ('OWNER','MEMBER');
create type public.visibility as enum ('PRIVATE','SHARED');
create type public.account_type as enum ('CHECKING','SAVINGS','CASH','INVESTMENT','OTHER');
create type public.category_type as enum ('INCOME','EXPENSE','BOTH');
create type public.transaction_type as enum ('INCOME','EXPENSE','TRANSFER');
create type public.settlement_status as enum ('PENDING','SETTLED','CANCELLED');
create type public.recurrence_frequency as enum ('WEEKLY','MONTHLY','YEARLY','CUSTOM');
create type public.task_status as enum ('TODO','DOING','DONE');
create type public.goal_status as enum ('ACTIVE','PAUSED','DONE');

create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

create table public.profiles (
  id uuid primary key,
  name text not null default '',
  email text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.workspaces to authenticated;
grant all on public.workspaces to service_role;
alter table public.workspaces enable row level security;
create trigger workspaces_updated before update on public.workspaces for each row execute function public.set_updated_at();

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null,
  role public.member_role not null default 'MEMBER',
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);
grant select, insert, update, delete on public.workspace_members to authenticated;
grant all on public.workspace_members to service_role;
alter table public.workspace_members enable row level security;

create or replace function public.is_workspace_member(_workspace_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workspace_members m
    where m.workspace_id = _workspace_id and m.user_id = auth.uid());
$$;

create or replace function public.is_workspace_owner(_workspace_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workspace_members m
    where m.workspace_id = _workspace_id and m.user_id = auth.uid() and m.role = 'OWNER');
$$;

create policy profiles_select on public.profiles for select to authenticated
using (id = auth.uid() or exists (
  select 1 from public.workspace_members a
  join public.workspace_members b on a.workspace_id = b.workspace_id
  where a.user_id = auth.uid() and b.user_id = public.profiles.id));
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy workspaces_select on public.workspaces for select to authenticated using (public.is_workspace_member(id));
create policy workspaces_insert on public.workspaces for insert to authenticated with check (owner_id = auth.uid());
create policy workspaces_update on public.workspaces for update to authenticated using (public.is_workspace_owner(id)) with check (owner_id = auth.uid());
create policy workspaces_delete on public.workspaces for delete to authenticated using (public.is_workspace_owner(id));

create policy wm_select on public.workspace_members for select to authenticated using (user_id = auth.uid() or public.is_workspace_member(workspace_id));
create policy wm_insert on public.workspace_members for insert to authenticated with check (public.is_workspace_owner(workspace_id));
create policy wm_update on public.workspace_members for update to authenticated using (public.is_workspace_owner(workspace_id)) with check (public.is_workspace_owner(workspace_id));
create policy wm_delete on public.workspace_members for delete to authenticated using (public.is_workspace_owner(workspace_id) or user_id = auth.uid());