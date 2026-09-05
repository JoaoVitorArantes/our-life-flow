create or replace function public.bootstrap_account(_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _email text;
  _ws uuid;
begin
  if _uid is null then raise exception 'not authenticated'; end if;
  select email into _email from auth.users where id = _uid;

  insert into public.profiles (id, name, email)
  values (_uid, coalesce(nullif(_name,''), split_part(coalesce(_email,'you@lifeos'),'@',1)), _email)
  on conflict (id) do update set email = excluded.email,
    name = case when public.profiles.name = '' then excluded.name else public.profiles.name end;

  select w.id into _ws from public.workspaces w
    join public.workspace_members m on m.workspace_id = w.id
    where m.user_id = _uid order by w.created_at limit 1;

  if _ws is null then
    insert into public.workspaces (name, owner_id) values ('Life OS', _uid) returning id into _ws;
    insert into public.workspace_members (workspace_id, user_id, role) values (_ws, _uid, 'OWNER');
  end if;

  if not exists (select 1 from public.categories where workspace_id = _ws) then
    insert into public.categories (workspace_id, name, icon, color, type) values
      (_ws,'Alimentação','utensils','#F59E0B','EXPENSE'),
      (_ws,'Transporte','car','#3B82F6','EXPENSE'),
      (_ws,'Moradia','home','#8B5CF6','EXPENSE'),
      (_ws,'Faculdade','graduation-cap','#06B6D4','EXPENSE'),
      (_ws,'Lazer','sparkles','#EC4899','EXPENSE'),
      (_ws,'Saúde','heart-pulse','#EF4444','EXPENSE'),
      (_ws,'Casal','heart','#F43F5E','BOTH'),
      (_ws,'Dívidas','trending-down','#DC2626','EXPENSE'),
      (_ws,'Investimentos','line-chart','#10B981','BOTH'),
      (_ws,'Salário','wallet','#22C55E','INCOME'),
      (_ws,'Outros','circle-dot','#94A3B8','BOTH');
  end if;

  return _ws;
end;
$$;

revoke execute on function public.bootstrap_account(text) from public, anon;
grant execute on function public.bootstrap_account(text) to authenticated;