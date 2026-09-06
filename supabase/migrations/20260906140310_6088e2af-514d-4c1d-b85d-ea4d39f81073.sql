DROP POLICY IF EXISTS transactions_update ON public.transactions;
DROP POLICY IF EXISTS transactions_delete ON public.transactions;

CREATE POLICY transactions_update ON public.transactions
  FOR UPDATE TO authenticated
  USING (user_is_workspace_member(workspace_id) AND (owner_id = auth.uid() OR visibility = 'SHARED'::public.visibility))
  WITH CHECK (user_is_workspace_member(workspace_id) AND (owner_id = auth.uid() OR visibility = 'SHARED'::public.visibility));

CREATE POLICY transactions_delete ON public.transactions
  FOR DELETE TO authenticated
  USING (user_is_workspace_member(workspace_id) AND (owner_id = auth.uid() OR visibility = 'SHARED'::public.visibility));