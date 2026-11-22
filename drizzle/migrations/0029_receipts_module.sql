CREATE TABLE public.receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  merchant text CHECK (merchant IS NULL OR char_length(merchant) <= 160),
  receipt_date date,
  total numeric(12,2) CHECK (total IS NULL OR total >= 0),
  currency text NOT NULL DEFAULT 'BRL' CHECK (char_length(currency) = 3),
  category text NOT NULL DEFAULT 'Outros' CHECK (char_length(category) BETWEEN 1 AND 60),
  payment_method text CHECK (payment_method IS NULL OR char_length(payment_method) <= 60),
  description text CHECK (description IS NULL OR char_length(description) <= 300),
  items jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(items) = 'array'),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 1000),
  document_number text CHECK (document_number IS NULL OR char_length(document_number) <= 80),
  file_path text CHECK (file_path IS NULL OR char_length(file_path) <= 300),
  file_name text CHECK (file_name IS NULL OR char_length(file_name) <= 200),
  ai_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX receipts_ws_date_idx ON public.receipts (workspace_id, receipt_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.receipts TO authenticated;
GRANT ALL ON public.receipts TO service_role;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY receipts_select ON public.receipts FOR SELECT TO authenticated USING (public.user_is_workspace_member(workspace_id));
CREATE POLICY receipts_insert ON public.receipts FOR INSERT TO authenticated WITH CHECK (public.user_is_workspace_member(workspace_id) AND created_by = auth.uid());
CREATE POLICY receipts_update ON public.receipts FOR UPDATE TO authenticated USING (public.user_is_workspace_member(workspace_id)) WITH CHECK (public.user_is_workspace_member(workspace_id));
CREATE POLICY receipts_delete ON public.receipts FOR DELETE TO authenticated USING (public.user_is_workspace_member(workspace_id));

CREATE OR REPLACE FUNCTION public.receipts_protect_identity() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.workspace_id := OLD.workspace_id; NEW.created_by := OLD.created_by; NEW.created_at := OLD.created_at;
  -- o arquivo precisa ficar na pasta do próprio espaço
  IF NEW.file_path IS NOT NULL AND split_part(NEW.file_path, '/', 1) <> NEW.workspace_id::text THEN
    RAISE EXCEPTION 'Arquivo fora do espaço';
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.receipts_check_file() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.file_path IS NOT NULL AND split_part(NEW.file_path, '/', 1) <> NEW.workspace_id::text THEN
    RAISE EXCEPTION 'Arquivo fora do espaço';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.receipts_protect_identity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.receipts_check_file() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER receipts_identity BEFORE UPDATE ON public.receipts FOR EACH ROW EXECUTE FUNCTION public.receipts_protect_identity();
CREATE TRIGGER receipts_file BEFORE INSERT ON public.receipts FOR EACH ROW EXECUTE FUNCTION public.receipts_check_file();
CREATE TRIGGER receipts_updated_at BEFORE UPDATE ON public.receipts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER receipts_sync AFTER INSERT OR UPDATE OR DELETE ON public.receipts FOR EACH ROW EXECUTE FUNCTION public.emit_workspace_sync_event();

CREATE OR REPLACE FUNCTION public.receipt_object_allowed(_bucket text, _name text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE folder text;
BEGIN
  IF _bucket <> 'receipts' THEN RETURN false; END IF;
  folder := split_part(_name, '/', 1);
  IF folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN false; END IF;
  RETURN public.user_is_workspace_member(folder::uuid);
END $$;
REVOKE ALL ON FUNCTION public.receipt_object_allowed(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.receipt_object_allowed(text, text) TO authenticated;

CREATE POLICY receipts_objects_select ON storage.objects FOR SELECT TO authenticated USING (public.receipt_object_allowed(bucket_id, name));
CREATE POLICY receipts_objects_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (public.receipt_object_allowed(bucket_id, name));
CREATE POLICY receipts_objects_delete ON storage.objects FOR DELETE TO authenticated USING (public.receipt_object_allowed(bucket_id, name));