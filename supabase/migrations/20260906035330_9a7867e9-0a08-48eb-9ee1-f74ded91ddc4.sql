DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['accounts','cards','transactions','events','tasks','goals','notes','contexts','installment_plans','loans','financings','recurring_transactions']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_workspace_all ON public.%I', table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_insert ON public.%I', table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_update ON public.%I', table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_delete ON public.%I', table_name, table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.user_is_workspace_member(workspace_id) AND (owner_id = auth.uid() OR visibility = ''SHARED''::public.visibility))', table_name || '_select', table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.user_is_workspace_member(workspace_id) AND owner_id = auth.uid())', table_name || '_insert', table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.user_is_workspace_member(workspace_id) AND owner_id = auth.uid()) WITH CHECK (public.user_is_workspace_member(workspace_id) AND owner_id = auth.uid())', table_name || '_update', table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.user_is_workspace_member(workspace_id) AND owner_id = auth.uid())', table_name || '_delete', table_name);
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS recurring_select ON public.recurring_transactions;
DROP POLICY IF EXISTS recurring_insert ON public.recurring_transactions;
DROP POLICY IF EXISTS recurring_update ON public.recurring_transactions;
DROP POLICY IF EXISTS recurring_delete ON public.recurring_transactions;