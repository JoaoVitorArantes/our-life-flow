CREATE TABLE public.wedding_budget_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id)
);
CREATE UNIQUE INDEX wedding_budget_categories_name_uq
  ON public.wedding_budget_categories (workspace_id, lower(btrim(name)));

CREATE TABLE public.wedding_budget_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  category_id uuid,
  supplier_id uuid,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  planned_amount numeric(14,2) CHECK (planned_amount IS NULL OR (planned_amount >= 0 AND planned_amount <= 100000000)),
  contracted_amount numeric(14,2) CHECK (contracted_amount IS NULL OR (contracted_amount >= 0 AND contracted_amount <= 100000000)),
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','quoting','contracted','cancelled')),
  due_date date CHECK (due_date IS NULL OR (due_date >= DATE '1900-01-01' AND due_date <= DATE '9999-12-31')),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 2000),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  FOREIGN KEY (workspace_id, category_id) REFERENCES public.wedding_budget_categories(workspace_id, id) ON DELETE SET NULL (category_id),
  FOREIGN KEY (workspace_id, supplier_id) REFERENCES public.wedding_suppliers(workspace_id, id) ON DELETE SET NULL (supplier_id)
);
CREATE INDEX wedding_budget_items_ws_idx ON public.wedding_budget_items (workspace_id, category_id);

CREATE TABLE public.wedding_budget_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  item_id uuid NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0 AND amount <= 100000000),
  paid_on date NOT NULL DEFAULT CURRENT_DATE CHECK (paid_on >= DATE '1900-01-01' AND paid_on <= DATE '9999-12-31'),
  paid_by_user_id uuid,
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (workspace_id, item_id) REFERENCES public.wedding_budget_items(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, paid_by_user_id) REFERENCES public.workspace_members(workspace_id, user_id)
);
CREATE INDEX wedding_budget_payments_item_idx ON public.wedding_budget_payments (workspace_id, item_id);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['wedding_budget_categories','wedding_budget_items','wedding_budget_payments'] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, PUBLIC', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.user_is_workspace_member(workspace_id))', t || '_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.user_is_workspace_member(workspace_id) AND created_by = auth.uid())', t || '_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.user_is_workspace_member(workspace_id)) WITH CHECK (public.user_is_workspace_member(workspace_id))', t || '_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.user_is_workspace_member(workspace_id))', t || '_delete', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF workspace_id ON public.%I FOR EACH ROW EXECUTE FUNCTION public.wedding_block_demo()', t || '_no_demo', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.prevent_workspace_move()', t || '_no_move', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t || '_updated_at', t);
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.emit_workspace_sync_event()', t || '_sync', t);
  END LOOP;
END $$;