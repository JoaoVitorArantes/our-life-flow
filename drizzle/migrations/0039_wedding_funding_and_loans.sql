CREATE TABLE public.wedding_funding_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('own','loan','family')),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  promised_amount numeric(14,2) CHECK (promised_amount IS NULL OR (promised_amount >= 0 AND promised_amount <= 100000000)),
  received_amount numeric(14,2) CHECK (received_amount IS NULL OR (received_amount >= 0 AND received_amount <= 100000000)),
  received_on date CHECK (received_on IS NULL OR (received_on >= DATE '1900-01-01' AND received_on <= DATE '9999-12-31')),
  total_to_repay numeric(14,2) CHECK (total_to_repay IS NULL OR (total_to_repay >= 0 AND total_to_repay <= 100000000)),
  financial_cost numeric(14,2) CHECK (financial_cost IS NULL OR (financial_cost >= 0 AND financial_cost <= 100000000)),
  interest_note text CHECK (interest_note IS NULL OR char_length(interest_note) <= 200),
  installment_count integer CHECK (installment_count IS NULL OR (installment_count BETWEEN 1 AND 600)),
  installment_amount numeric(14,2) CHECK (installment_amount IS NULL OR (installment_amount > 0 AND installment_amount <= 100000000)),
  first_due_date date CHECK (first_due_date IS NULL OR (first_due_date >= DATE '1900-01-01' AND first_due_date <= DATE '9999-12-31')),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 2000),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id)
);
CREATE INDEX wedding_funding_sources_ws_idx ON public.wedding_funding_sources (workspace_id, kind);

CREATE TABLE public.wedding_loan_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source_id uuid NOT NULL,
  number integer NOT NULL CHECK (number BETWEEN 1 AND 600),
  due_date date NOT NULL CHECK (due_date >= DATE '1900-01-01' AND due_date <= DATE '9999-12-31'),
  amount numeric(14,2) NOT NULL CHECK (amount > 0 AND amount <= 100000000),
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  UNIQUE (source_id, number),
  FOREIGN KEY (workspace_id, source_id) REFERENCES public.wedding_funding_sources(workspace_id, id) ON DELETE CASCADE
);
CREATE INDEX wedding_loan_installments_src_idx ON public.wedding_loan_installments (workspace_id, source_id);

CREATE TABLE public.wedding_loan_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  installment_id uuid NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0 AND amount <= 100000000),
  paid_on date NOT NULL CHECK (paid_on >= DATE '1900-01-01' AND paid_on <= DATE '9999-12-31'),
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (workspace_id, installment_id) REFERENCES public.wedding_loan_installments(workspace_id, id) ON DELETE CASCADE
);
CREATE INDEX wedding_loan_payments_inst_idx ON public.wedding_loan_payments (workspace_id, installment_id);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['wedding_funding_sources','wedding_loan_installments','wedding_loan_payments'] LOOP
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