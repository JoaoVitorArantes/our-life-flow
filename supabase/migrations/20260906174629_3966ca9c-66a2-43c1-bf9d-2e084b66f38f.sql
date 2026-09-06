CREATE TABLE public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL,
  description text,
  category text,
  budget_amount numeric(14,2),
  found_price numeric(14,2),
  purchase_url text,
  image_url text,
  priority text NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW','MEDIUM','HIGH')),
  status text NOT NULL DEFAULT 'WANT_TO_BUY' CHECK (status IN ('WANT_TO_BUY','RESEARCHING','DECIDED','PURCHASED','DISCARDED')),
  desired_date date,
  context_id uuid REFERENCES public.contexts(id) ON DELETE SET NULL,
  person_scope text NOT NULL DEFAULT 'COUPLE' CHECK (person_scope IN ('JOAO','RENIFER','COUPLE')),
  notes text,
  purchased_at date,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX purchases_workspace_idx ON public.purchases (workspace_id, created_at DESC);
CREATE INDEX purchases_context_idx ON public.purchases (context_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY purchases_select ON public.purchases FOR SELECT TO authenticated
  USING (public.user_is_workspace_member(workspace_id));
CREATE POLICY purchases_insert ON public.purchases FOR INSERT TO authenticated
  WITH CHECK (public.user_is_workspace_member(workspace_id) AND created_by = auth.uid());
CREATE POLICY purchases_update ON public.purchases FOR UPDATE TO authenticated
  USING (public.user_is_workspace_member(workspace_id))
  WITH CHECK (public.user_is_workspace_member(workspace_id));
CREATE POLICY purchases_delete ON public.purchases FOR DELETE TO authenticated
  USING (public.user_is_workspace_member(workspace_id));

CREATE TRIGGER purchases_updated BEFORE UPDATE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER purchases_prevent_move BEFORE UPDATE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.prevent_workspace_move();