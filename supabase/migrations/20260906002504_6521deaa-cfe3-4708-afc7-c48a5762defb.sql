-- Workspace-scoped access for all Life OS tables

-- helper alias requested: user_is_workspace_member
CREATE OR REPLACE FUNCTION public.user_is_workspace_member(_workspace_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspace_members m
    WHERE m.workspace_id = _workspace_id AND m.user_id = auth.uid());
$$;
REVOKE EXECUTE ON FUNCTION public.user_is_workspace_member(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.user_is_workspace_member(uuid) TO authenticated, service_role;

-- Direct workspace-scoped tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['accounts','cards','categories','contexts','events','financings','goals','installment_plans','loans','notes','recurring_transactions','settlements','tasks','transactions']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_delete', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_write', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_all', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_workspace_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.user_is_workspace_member(workspace_id)) WITH CHECK (public.user_is_workspace_member(workspace_id))',
      t||'_workspace_all', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

-- settlements policies may have different names
DROP POLICY IF EXISTS settlements_member_select ON public.settlements;
DROP POLICY IF EXISTS settlements_member_write ON public.settlements;

-- Child tables scoped through their parent transaction
DROP POLICY IF EXISTS transaction_splits_select ON public.transaction_splits;
DROP POLICY IF EXISTS transaction_splits_write ON public.transaction_splits;
DROP POLICY IF EXISTS transaction_splits_insert ON public.transaction_splits;
DROP POLICY IF EXISTS transaction_splits_update ON public.transaction_splits;
DROP POLICY IF EXISTS transaction_splits_delete ON public.transaction_splits;
DROP POLICY IF EXISTS transaction_splits_workspace_all ON public.transaction_splits;
CREATE POLICY transaction_splits_workspace_all ON public.transaction_splits FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_splits.transaction_id AND public.user_is_workspace_member(t.workspace_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_splits.transaction_id AND public.user_is_workspace_member(t.workspace_id)));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_splits TO authenticated;
GRANT ALL ON public.transaction_splits TO service_role;

DROP POLICY IF EXISTS installments_select ON public.installments;
DROP POLICY IF EXISTS installments_write ON public.installments;
DROP POLICY IF EXISTS installments_insert ON public.installments;
DROP POLICY IF EXISTS installments_update ON public.installments;
DROP POLICY IF EXISTS installments_delete ON public.installments;
DROP POLICY IF EXISTS installments_workspace_all ON public.installments;
CREATE POLICY installments_workspace_all ON public.installments FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = installments.transaction_id AND public.user_is_workspace_member(t.workspace_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = installments.transaction_id AND public.user_is_workspace_member(t.workspace_id)));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.installments TO authenticated;
GRANT ALL ON public.installments TO service_role;

DROP POLICY IF EXISTS goal_contributions_select ON public.goal_contributions;
DROP POLICY IF EXISTS goal_contributions_insert ON public.goal_contributions;
DROP POLICY IF EXISTS goal_contributions_update ON public.goal_contributions;
DROP POLICY IF EXISTS goal_contributions_delete ON public.goal_contributions;
DROP POLICY IF EXISTS goal_contributions_workspace_all ON public.goal_contributions;
CREATE POLICY goal_contributions_workspace_all ON public.goal_contributions FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_contributions.goal_id AND public.user_is_workspace_member(g.workspace_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_contributions.goal_id AND public.user_is_workspace_member(g.workspace_id)));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goal_contributions TO authenticated;
GRANT ALL ON public.goal_contributions TO service_role;

-- Profiles: members of the same workspace can see each other
DROP POLICY IF EXISTS profiles_select ON public.profiles;
DROP POLICY IF EXISTS profiles_workspace_select ON public.profiles;
CREATE POLICY profiles_workspace_select ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.workspace_members me
    JOIN public.workspace_members other ON other.workspace_id = me.workspace_id
    WHERE me.user_id = auth.uid() AND other.user_id = profiles.id
  )
);

-- Default new records to shared visibility
ALTER TABLE public.accounts ALTER COLUMN visibility SET DEFAULT 'SHARED';
ALTER TABLE public.cards ALTER COLUMN visibility SET DEFAULT 'SHARED';
ALTER TABLE public.contexts ALTER COLUMN visibility SET DEFAULT 'SHARED';
ALTER TABLE public.events ALTER COLUMN visibility SET DEFAULT 'SHARED';
ALTER TABLE public.financings ALTER COLUMN visibility SET DEFAULT 'SHARED';
ALTER TABLE public.goals ALTER COLUMN visibility SET DEFAULT 'SHARED';
ALTER TABLE public.installment_plans ALTER COLUMN visibility SET DEFAULT 'SHARED';
ALTER TABLE public.loans ALTER COLUMN visibility SET DEFAULT 'SHARED';
ALTER TABLE public.notes ALTER COLUMN visibility SET DEFAULT 'SHARED';
ALTER TABLE public.recurring_transactions ALTER COLUMN visibility SET DEFAULT 'SHARED';
ALTER TABLE public.tasks ALTER COLUMN visibility SET DEFAULT 'SHARED';
ALTER TABLE public.transactions ALTER COLUMN visibility SET DEFAULT 'SHARED';