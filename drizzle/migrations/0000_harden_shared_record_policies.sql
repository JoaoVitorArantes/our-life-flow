-- 1) Lock down SECURITY DEFINER functions: no PUBLIC execute, explicit grants only.
REVOKE ALL ON FUNCTION public.bootstrap_account(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_workspace_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_workspace_owner(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_is_workspace_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rebuild_settlements(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rebuild_transaction_settlement(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_rebuild_settlement() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_workspace_member_limit() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.bootstrap_account(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_workspace_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_account(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.rebuild_settlements(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.rebuild_transaction_settlement(uuid) TO service_role;

-- 2) goal_contributions: keep shared read/edit, but forbid creating or
--    re-assigning a contribution under someone else's identity.
DROP POLICY IF EXISTS goal_contributions_workspace_all ON public.goal_contributions;

CREATE POLICY goal_contributions_select ON public.goal_contributions
  FOR SELECT TO authenticated
  USING (public.user_is_workspace_member(workspace_id));

CREATE POLICY goal_contributions_insert ON public.goal_contributions
  FOR INSERT TO authenticated
  WITH CHECK (public.user_is_workspace_member(workspace_id) AND user_id = auth.uid());

CREATE POLICY goal_contributions_update ON public.goal_contributions
  FOR UPDATE TO authenticated
  USING (public.user_is_workspace_member(workspace_id))
  WITH CHECK (public.user_is_workspace_member(workspace_id));

CREATE POLICY goal_contributions_delete ON public.goal_contributions
  FOR DELETE TO authenticated
  USING (public.user_is_workspace_member(workspace_id));

CREATE OR REPLACE FUNCTION public.protect_contribution_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Não é permitido alterar o autor da movimentação.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_contribution_identity() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS goal_contributions_protect_identity ON public.goal_contributions;
CREATE TRIGGER goal_contributions_protect_identity
  BEFORE UPDATE ON public.goal_contributions
  FOR EACH ROW EXECUTE FUNCTION public.protect_contribution_identity();

-- 3) transaction_splits / transaction_payers: writes must target a transaction
--    the member can actually see (shared or their own), not just any row that
--    carries a workspace id.
DROP POLICY IF EXISTS transaction_splits_workspace_all ON public.transaction_splits;
DROP POLICY IF EXISTS splits_write ON public.transaction_splits;
DROP POLICY IF EXISTS splits_select ON public.transaction_splits;
DROP POLICY IF EXISTS transaction_payers_workspace_all ON public.transaction_payers;

CREATE POLICY transaction_splits_select ON public.transaction_splits
  FOR SELECT TO authenticated
  USING (
    public.user_is_workspace_member(workspace_id)
    AND EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_splits.transaction_id
        AND t.workspace_id = transaction_splits.workspace_id
        AND (t.visibility = 'SHARED'::visibility OR t.owner_id = auth.uid())
    )
  );

CREATE POLICY transaction_splits_write ON public.transaction_splits
  FOR ALL TO authenticated
  USING (
    public.user_is_workspace_member(workspace_id)
    AND EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_splits.transaction_id
        AND t.workspace_id = transaction_splits.workspace_id
        AND (t.visibility = 'SHARED'::visibility OR t.owner_id = auth.uid())
    )
  )
  WITH CHECK (
    public.user_is_workspace_member(workspace_id)
    AND EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_splits.transaction_id
        AND t.workspace_id = transaction_splits.workspace_id
        AND (t.visibility = 'SHARED'::visibility OR t.owner_id = auth.uid())
    )
    AND public.user_is_workspace_member(workspace_id)
    AND EXISTS (
      SELECT 1 FROM public.workspace_members m
      WHERE m.workspace_id = transaction_splits.workspace_id
        AND m.user_id = transaction_splits.user_id
    )
  );

CREATE POLICY transaction_payers_select ON public.transaction_payers
  FOR SELECT TO authenticated
  USING (
    public.user_is_workspace_member(workspace_id)
    AND EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_payers.transaction_id
        AND t.workspace_id = transaction_payers.workspace_id
        AND (t.visibility = 'SHARED'::visibility OR t.owner_id = auth.uid())
    )
  );

CREATE POLICY transaction_payers_write ON public.transaction_payers
  FOR ALL TO authenticated
  USING (
    public.user_is_workspace_member(workspace_id)
    AND EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_payers.transaction_id
        AND t.workspace_id = transaction_payers.workspace_id
        AND (t.visibility = 'SHARED'::visibility OR t.owner_id = auth.uid())
    )
  )
  WITH CHECK (
    public.user_is_workspace_member(workspace_id)
    AND EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_payers.transaction_id
        AND t.workspace_id = transaction_payers.workspace_id
        AND (t.visibility = 'SHARED'::visibility OR t.owner_id = auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.workspace_members m
      WHERE m.workspace_id = transaction_payers.workspace_id
        AND m.user_id = transaction_payers.user_id
    )
  );