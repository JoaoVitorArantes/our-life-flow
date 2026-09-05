revoke execute on function public.is_workspace_member(uuid) from public, anon;
revoke execute on function public.is_workspace_owner(uuid) from public, anon;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  icon text,
  color text,
  type public.category_type not null default 'BOTH',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.categories to authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
create policy categories_select on public.categories for select to authenticated using (public.is_workspace_member(workspace_id));
create policy categories_write on public.categories for all to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_id uuid not null,
  name text not null,
  institution text,
  account_type public.account_type not null default 'CHECKING',
  initial_balance numeric(14,2) not null default 0,
  current_balance numeric(14,2) not null default 0,
  visibility public.visibility not null default 'SHARED',
  is_active boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.accounts to authenticated;
grant all on public.accounts to service_role;
alter table public.accounts enable row level security;
create trigger accounts_updated before update on public.accounts for each row execute function public.set_updated_at();
create policy accounts_select on public.accounts for select to authenticated using (public.is_workspace_member(workspace_id) and (visibility = 'SHARED' or owner_id = auth.uid()));
create policy accounts_insert on public.accounts for insert to authenticated with check (owner_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy accounts_update on public.accounts for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy accounts_delete on public.accounts for delete to authenticated using (owner_id = auth.uid());

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_id uuid not null,
  name text not null,
  institution text,
  credit_limit numeric(14,2) not null default 0,
  closing_day smallint,
  due_day smallint,
  payment_account_id uuid references public.accounts(id) on delete set null,
  visibility public.visibility not null default 'SHARED',
  is_active boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.cards to authenticated;
grant all on public.cards to service_role;
alter table public.cards enable row level security;
create trigger cards_updated before update on public.cards for each row execute function public.set_updated_at();
create policy cards_select on public.cards for select to authenticated using (public.is_workspace_member(workspace_id) and (visibility = 'SHARED' or owner_id = auth.uid()));
create policy cards_insert on public.cards for insert to authenticated with check (owner_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy cards_update on public.cards for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy cards_delete on public.cards for delete to authenticated using (owner_id = auth.uid());

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_id uuid not null,
  type public.transaction_type not null,
  amount numeric(14,2) not null,
  description text not null,
  transaction_date date not null default current_date,
  category_id uuid references public.categories(id) on delete set null,
  account_id uuid references public.accounts(id) on delete set null,
  card_id uuid references public.cards(id) on delete set null,
  source_account_id uuid references public.accounts(id) on delete set null,
  destination_account_id uuid references public.accounts(id) on delete set null,
  visibility public.visibility not null default 'PRIVATE',
  is_shared boolean not null default false,
  notes text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index transactions_ws_date_idx on public.transactions (workspace_id, transaction_date desc);
grant select, insert, update, delete on public.transactions to authenticated;
grant all on public.transactions to service_role;
alter table public.transactions enable row level security;
create trigger transactions_updated before update on public.transactions for each row execute function public.set_updated_at();
create policy transactions_select on public.transactions for select to authenticated using (public.is_workspace_member(workspace_id) and (visibility = 'SHARED' or owner_id = auth.uid()));
create policy transactions_insert on public.transactions for insert to authenticated with check (owner_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy transactions_update on public.transactions for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy transactions_delete on public.transactions for delete to authenticated using (owner_id = auth.uid());

create table public.transaction_splits (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  user_id uuid not null,
  amount numeric(14,2) not null default 0,
  percentage numeric(6,2),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.transaction_splits to authenticated;
grant all on public.transaction_splits to service_role;
alter table public.transaction_splits enable row level security;
create policy splits_select on public.transaction_splits for select to authenticated
using (exists (select 1 from public.transactions t where t.id = transaction_id
  and public.is_workspace_member(t.workspace_id) and (t.visibility = 'SHARED' or t.owner_id = auth.uid())));
create policy splits_write on public.transaction_splits for all to authenticated
using (exists (select 1 from public.transactions t where t.id = transaction_id and t.owner_id = auth.uid()))
with check (exists (select 1 from public.transactions t where t.id = transaction_id and t.owner_id = auth.uid()));

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  from_user_id uuid not null,
  to_user_id uuid not null,
  amount numeric(14,2) not null,
  status public.settlement_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
grant select, insert, update, delete on public.settlements to authenticated;
grant all on public.settlements to service_role;
alter table public.settlements enable row level security;
create policy settlements_select on public.settlements for select to authenticated using (public.is_workspace_member(workspace_id));
create policy settlements_write on public.settlements for all to authenticated
using (public.is_workspace_member(workspace_id) and (from_user_id = auth.uid() or to_user_id = auth.uid()))
with check (public.is_workspace_member(workspace_id) and (from_user_id = auth.uid() or to_user_id = auth.uid()));

create table public.installments (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  total_installments smallint not null,
  current_installment smallint not null default 1,
  installment_amount numeric(14,2) not null,
  start_date date not null default current_date,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.installments to authenticated;
grant all on public.installments to service_role;
alter table public.installments enable row level security;
create policy installments_select on public.installments for select to authenticated
using (exists (select 1 from public.transactions t where t.id = transaction_id
  and public.is_workspace_member(t.workspace_id) and (t.visibility = 'SHARED' or t.owner_id = auth.uid())));
create policy installments_write on public.installments for all to authenticated
using (exists (select 1 from public.transactions t where t.id = transaction_id and t.owner_id = auth.uid()))
with check (exists (select 1 from public.transactions t where t.id = transaction_id and t.owner_id = auth.uid()));

create table public.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_id uuid not null,
  description text not null,
  amount numeric(14,2) not null,
  type public.transaction_type not null,
  category_id uuid references public.categories(id) on delete set null,
  account_id uuid references public.accounts(id) on delete set null,
  frequency public.recurrence_frequency not null default 'MONTHLY',
  start_date date not null default current_date,
  end_date date,
  next_date date,
  visibility public.visibility not null default 'PRIVATE',
  is_active boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.recurring_transactions to authenticated;
grant all on public.recurring_transactions to service_role;
alter table public.recurring_transactions enable row level security;
create trigger recurring_updated before update on public.recurring_transactions for each row execute function public.set_updated_at();
create policy recurring_select on public.recurring_transactions for select to authenticated using (public.is_workspace_member(workspace_id) and (visibility = 'SHARED' or owner_id = auth.uid()));
create policy recurring_insert on public.recurring_transactions for insert to authenticated with check (owner_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy recurring_update on public.recurring_transactions for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy recurring_delete on public.recurring_transactions for delete to authenticated using (owner_id = auth.uid());

create table public.events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_id uuid not null,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  visibility public.visibility not null default 'PRIVATE',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.events to authenticated;
grant all on public.events to service_role;
alter table public.events enable row level security;
create trigger events_updated before update on public.events for each row execute function public.set_updated_at();
create policy events_select on public.events for select to authenticated using (public.is_workspace_member(workspace_id) and (visibility = 'SHARED' or owner_id = auth.uid()));
create policy events_insert on public.events for insert to authenticated with check (owner_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy events_update on public.events for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy events_delete on public.events for delete to authenticated using (owner_id = auth.uid());

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_id uuid not null,
  title text not null,
  notes text,
  due_date date,
  status public.task_status not null default 'TODO',
  visibility public.visibility not null default 'PRIVATE',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.tasks to authenticated;
grant all on public.tasks to service_role;
alter table public.tasks enable row level security;
create trigger tasks_updated before update on public.tasks for each row execute function public.set_updated_at();
create policy tasks_select on public.tasks for select to authenticated using (public.is_workspace_member(workspace_id) and (visibility = 'SHARED' or owner_id = auth.uid()));
create policy tasks_insert on public.tasks for insert to authenticated with check (owner_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy tasks_update on public.tasks for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy tasks_delete on public.tasks for delete to authenticated using (owner_id = auth.uid());

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_id uuid not null,
  title text not null,
  description text,
  target_amount numeric(14,2),
  current_amount numeric(14,2) not null default 0,
  due_date date,
  status public.goal_status not null default 'ACTIVE',
  visibility public.visibility not null default 'PRIVATE',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.goals to authenticated;
grant all on public.goals to service_role;
alter table public.goals enable row level security;
create trigger goals_updated before update on public.goals for each row execute function public.set_updated_at();
create policy goals_select on public.goals for select to authenticated using (public.is_workspace_member(workspace_id) and (visibility = 'SHARED' or owner_id = auth.uid()));
create policy goals_insert on public.goals for insert to authenticated with check (owner_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy goals_update on public.goals for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy goals_delete on public.goals for delete to authenticated using (owner_id = auth.uid());

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_id uuid not null,
  title text not null,
  content text,
  visibility public.visibility not null default 'PRIVATE',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.notes to authenticated;
grant all on public.notes to service_role;
alter table public.notes enable row level security;
create trigger notes_updated before update on public.notes for each row execute function public.set_updated_at();
create policy notes_select on public.notes for select to authenticated using (public.is_workspace_member(workspace_id) and (visibility = 'SHARED' or owner_id = auth.uid()));
create policy notes_insert on public.notes for insert to authenticated with check (owner_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy notes_update on public.notes for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy notes_delete on public.notes for delete to authenticated using (owner_id = auth.uid());