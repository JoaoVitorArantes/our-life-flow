CREATE TABLE public.transaction_payers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (transaction_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_payers TO authenticated;
GRANT ALL ON public.transaction_payers TO service_role;

ALTER TABLE public.transaction_payers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transaction_payers_workspace_all" ON public.transaction_payers
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_payers.transaction_id AND public.user_is_workspace_member(t.workspace_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_payers.transaction_id AND public.user_is_workspace_member(t.workspace_id)));

CREATE INDEX transaction_payers_transaction_idx ON public.transaction_payers(transaction_id);

ALTER TABLE public.settlements
  ADD COLUMN IF NOT EXISTS transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS settlements_one_pending_per_transaction
  ON public.settlements(transaction_id)
  WHERE status = 'PENDING' AND transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS settlements_workspace_status_idx ON public.settlements(workspace_id, status);

DROP TRIGGER IF EXISTS settlements_updated ON public.settlements;
CREATE TRIGGER settlements_updated BEFORE UPDATE ON public.settlements
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();