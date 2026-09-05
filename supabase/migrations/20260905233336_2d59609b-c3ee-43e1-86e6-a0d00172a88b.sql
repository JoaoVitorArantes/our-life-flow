-- enums
create type public.payment_status as enum ('PENDING','PAID','OVERDUE','CANCELLED');
create type public.loan_type as enum ('LENT','BORROWED');
create type public.obligation_status as enum ('ACTIVE','COMPLETED','CANCELLED');

-- installment plans
create table public.installment_plans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_id uuid not null,
  description text not null,
  total_amount numeric not null default 0,
  total_installments smallint not null default 1,
  installment_amount numeric not null default 0,
  start_date date not null,
  category_id uuid references public.categories(id) on delete set null,
  account_id uuid references public.accounts(id) on delete set null,
  card_id uuid references public.cards(id) on delete set null,
  context_id uuid references public.contexts(id) on delete set null,
  visibility public.visibility not null default 'PRIVATE',
  notes text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.installment_plans to authenticated;
grant all on public.installment_plans to service_role;
alter table public.installment_plans enable row level security;
create policy installment_plans_select on public.installment_plans for select to authenticated
  using (public.is_workspace_member(workspace_id) and (visibility = 'SHARED' or owner_id = auth.uid()));
create policy installment_plans_insert on public.installment_plans for insert to authenticated
  with check (owner_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy installment_plans_update on public.installment_plans for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy installment_plans_delete on public.installment_plans for delete to authenticated
  using (owner_id = auth.uid());
create trigger installment_plans_updated before update on public.installment_plans
  for each row execute function public.set_updated_at();

-- loans
create table public.loans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_id uuid not null,
  type public.loan_type not null default 'LENT',
  person_name text not null,
  description text,
  total_amount numeric not null default 0,
  total_installments smallint not null default 1,
  installment_amount numeric not null default 0,
  start_date date not null,
  due_day smallint,
  account_id uuid references public.accounts(id) on delete set null,
  context_id uuid references public.contexts(id) on delete set null,
  status public.obligation_status not null default 'ACTIVE',
  visibility public.visibility not null default 'PRIVATE',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.loans to authenticated;
grant all on public.loans to service_role;
alter table public.loans enable row level security;
create policy loans_select on public.loans for select to authenticated
  using (public.is_workspace_member(workspace_id) and (visibility = 'SHARED' or owner_id = auth.uid()));
create policy loans_insert on public.loans for insert to authenticated
  with check (owner_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy loans_update on public.loans for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy loans_delete on public.loans for delete to authenticated
  using (owner_id = auth.uid());
create trigger loans_updated before update on public.loans
  for each row execute function public.set_updated_at();

-- financings
create table public.financings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_id uuid not null,
  name text not null,
  description text,
  financed_amount numeric not null default 0,
  total_installments smallint not null default 1,
  installment_amount numeric not null default 0,
  interest_rate numeric,
  start_date date not null,
  due_day smallint,
  account_id uuid references public.accounts(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  context_id uuid references public.contexts(id) on delete set null,
  status public.obligation_status not null default 'ACTIVE',
  visibility public.visibility not null default 'PRIVATE',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.financings to authenticated;
grant all on public.financings to service_role;
alter table public.financings enable row level security;
create policy financings_select on public.financings for select to authenticated
  using (public.is_workspace_member(workspace_id) and (visibility = 'SHARED' or owner_id = auth.uid()));
create policy financings_insert on public.financings for insert to authenticated
  with check (owner_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy financings_update on public.financings for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy financings_delete on public.financings for delete to authenticated
  using (owner_id = auth.uid());
create trigger financings_updated before update on public.financings
  for each row execute function public.set_updated_at();

-- transactions: status + links
alter table public.transactions
  add column status public.payment_status not null default 'PAID',
  add column paid_at date,
  add column due_date date,
  add column installment_plan_id uuid references public.installment_plans(id) on delete cascade,
  add column installment_number smallint,
  add column recurring_id uuid references public.recurring_transactions(id) on delete set null,
  add column loan_id uuid references public.loans(id) on delete cascade,
  add column financing_id uuid references public.financings(id) on delete cascade;

update public.transactions set paid_at = transaction_date where status = 'PAID';

create index idx_transactions_status on public.transactions (workspace_id, status);
create index idx_transactions_plan on public.transactions (installment_plan_id);
create index idx_transactions_loan on public.transactions (loan_id);
create index idx_transactions_financing on public.transactions (financing_id);
create unique index idx_transactions_recurring_occurrence
  on public.transactions (recurring_id, transaction_date)
  where recurring_id is not null;

-- recurring transactions extras
alter table public.recurring_transactions
  add column due_day smallint,
  add column card_id uuid references public.cards(id) on delete set null,
  add column context_id uuid references public.contexts(id) on delete set null;