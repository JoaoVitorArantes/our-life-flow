CREATE TABLE public.card_invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  due_date date NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  paid_at date NOT NULL DEFAULT current_date,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX card_invoice_payments_card_due_idx ON public.card_invoice_payments(card_id, due_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_invoice_payments TO authenticated;
GRANT ALL ON public.card_invoice_payments TO service_role;
ALTER TABLE public.card_invoice_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cip_select" ON public.card_invoice_payments FOR SELECT TO authenticated USING (public.user_is_workspace_member(workspace_id));
CREATE POLICY "cip_insert" ON public.card_invoice_payments FOR INSERT TO authenticated WITH CHECK (public.user_is_workspace_member(workspace_id) AND created_by = auth.uid() AND EXISTS (SELECT 1 FROM public.cards c WHERE c.id = card_id AND c.workspace_id = card_invoice_payments.workspace_id));
CREATE POLICY "cip_update" ON public.card_invoice_payments FOR UPDATE TO authenticated USING (public.user_is_workspace_member(workspace_id)) WITH CHECK (public.user_is_workspace_member(workspace_id));
CREATE POLICY "cip_delete" ON public.card_invoice_payments FOR DELETE TO authenticated USING (public.user_is_workspace_member(workspace_id));
CREATE TRIGGER prevent_workspace_move BEFORE UPDATE ON public.card_invoice_payments FOR EACH ROW EXECUTE FUNCTION public.prevent_workspace_move();