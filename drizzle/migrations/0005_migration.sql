create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null default auth.uid(),
  title text not null default 'Nova conversa',
  action_states jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.ai_conversations (workspace_id, updated_at desc);
grant select, insert, update, delete on public.ai_conversations to authenticated;
grant all on public.ai_conversations to service_role;
alter table public.ai_conversations enable row level security;
create policy "members read conversations" on public.ai_conversations for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "members create conversations" on public.ai_conversations for insert to authenticated with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());
create policy "members update conversations" on public.ai_conversations for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "members delete conversations" on public.ai_conversations for delete to authenticated using (public.is_workspace_member(workspace_id));

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  message_id text not null,
  role text not null,
  message jsonb not null,
  author_id uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (conversation_id, message_id)
);
create index on public.ai_messages (conversation_id, created_at);
grant select, insert, update, delete on public.ai_messages to authenticated;
grant all on public.ai_messages to service_role;
alter table public.ai_messages enable row level security;
create policy "members read ai messages" on public.ai_messages for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "members write ai messages" on public.ai_messages for insert to authenticated with check (public.is_workspace_member(workspace_id) and exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.workspace_id = ai_messages.workspace_id));
create policy "members update ai messages" on public.ai_messages for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "members delete ai messages" on public.ai_messages for delete to authenticated using (public.is_workspace_member(workspace_id));