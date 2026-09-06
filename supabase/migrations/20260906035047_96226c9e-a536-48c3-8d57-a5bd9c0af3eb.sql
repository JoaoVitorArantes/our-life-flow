ALTER TABLE public.transaction_splits ADD COLUMN workspace_id uuid;
UPDATE public.transaction_splits s SET workspace_id = t.workspace_id FROM public.transactions t WHERE t.id = s.transaction_id;
ALTER TABLE public.transaction_splits ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.transaction_splits ADD CONSTRAINT transaction_splits_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
CREATE INDEX transaction_splits_workspace_idx ON public.transaction_splits(workspace_id);

ALTER TABLE public.transaction_payers ADD COLUMN workspace_id uuid;
UPDATE public.transaction_payers p SET workspace_id = t.workspace_id FROM public.transactions t WHERE t.id = p.transaction_id;
ALTER TABLE public.transaction_payers ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.transaction_payers ADD CONSTRAINT transaction_payers_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
CREATE INDEX transaction_payers_workspace_idx ON public.transaction_payers(workspace_id);

ALTER TABLE public.installments ADD COLUMN workspace_id uuid;
UPDATE public.installments i SET workspace_id = t.workspace_id FROM public.transactions t WHERE t.id = i.transaction_id;
ALTER TABLE public.installments ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.installments ADD CONSTRAINT installments_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
CREATE INDEX installments_workspace_idx ON public.installments(workspace_id);

ALTER TABLE public.goal_contributions ADD COLUMN workspace_id uuid;
UPDATE public.goal_contributions c SET workspace_id = g.workspace_id FROM public.goals g WHERE g.id = c.goal_id;
ALTER TABLE public.goal_contributions ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.goal_contributions ADD CONSTRAINT goal_contributions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
CREATE INDEX goal_contributions_workspace_idx ON public.goal_contributions(workspace_id);

DROP POLICY IF EXISTS transaction_splits_workspace_all ON public.transaction_splits;
CREATE POLICY transaction_splits_workspace_all ON public.transaction_splits FOR ALL TO authenticated
USING (public.user_is_workspace_member(workspace_id))
WITH CHECK (public.user_is_workspace_member(workspace_id));
DROP POLICY IF EXISTS transaction_payers_workspace_all ON public.transaction_payers;
CREATE POLICY transaction_payers_workspace_all ON public.transaction_payers FOR ALL TO authenticated
USING (public.user_is_workspace_member(workspace_id))
WITH CHECK (public.user_is_workspace_member(workspace_id));
DROP POLICY IF EXISTS installments_workspace_all ON public.installments;
CREATE POLICY installments_workspace_all ON public.installments FOR ALL TO authenticated
USING (public.user_is_workspace_member(workspace_id))
WITH CHECK (public.user_is_workspace_member(workspace_id));
DROP POLICY IF EXISTS goal_contributions_workspace_all ON public.goal_contributions;
CREATE POLICY goal_contributions_workspace_all ON public.goal_contributions FOR ALL TO authenticated
USING (public.user_is_workspace_member(workspace_id))
WITH CHECK (public.user_is_workspace_member(workspace_id));

CREATE OR REPLACE FUNCTION public.validate_child_workspace()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME IN ('transaction_splits','transaction_payers','installments') THEN
    IF NOT EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = NEW.transaction_id AND t.workspace_id = NEW.workspace_id) THEN
      RAISE EXCEPTION 'A transação pertence a outro workspace.';
    END IF;
  ELSIF TG_TABLE_NAME = 'goal_contributions' THEN
    IF NOT EXISTS (SELECT 1 FROM public.goals g WHERE g.id = NEW.goal_id AND g.workspace_id = NEW.workspace_id) THEN
      RAISE EXCEPTION 'A meta pertence a outro workspace.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.validate_child_workspace() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_child_workspace() TO service_role;

CREATE TRIGGER transaction_splits_validate_workspace BEFORE INSERT OR UPDATE ON public.transaction_splits FOR EACH ROW EXECUTE FUNCTION public.validate_child_workspace();
CREATE TRIGGER transaction_payers_validate_workspace BEFORE INSERT OR UPDATE ON public.transaction_payers FOR EACH ROW EXECUTE FUNCTION public.validate_child_workspace();
CREATE TRIGGER installments_validate_workspace BEFORE INSERT OR UPDATE ON public.installments FOR EACH ROW EXECUTE FUNCTION public.validate_child_workspace();
CREATE TRIGGER goal_contributions_validate_workspace BEFORE INSERT OR UPDATE ON public.goal_contributions FOR EACH ROW EXECUTE FUNCTION public.validate_child_workspace();
CREATE TRIGGER transaction_splits_prevent_move BEFORE UPDATE OF workspace_id ON public.transaction_splits FOR EACH ROW EXECUTE FUNCTION public.prevent_workspace_move();
CREATE TRIGGER transaction_payers_prevent_move BEFORE UPDATE OF workspace_id ON public.transaction_payers FOR EACH ROW EXECUTE FUNCTION public.prevent_workspace_move();
CREATE TRIGGER installments_prevent_move BEFORE UPDATE OF workspace_id ON public.installments FOR EACH ROW EXECUTE FUNCTION public.prevent_workspace_move();
CREATE TRIGGER goal_contributions_prevent_move BEFORE UPDATE OF workspace_id ON public.goal_contributions FOR EACH ROW EXECUTE FUNCTION public.prevent_workspace_move();