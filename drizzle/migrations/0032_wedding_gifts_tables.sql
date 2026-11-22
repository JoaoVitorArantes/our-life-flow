CREATE TABLE public.wedding_gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('physical','fund','quota')),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  description text CHECK (description IS NULL OR char_length(description) <= 1000),
  image_path text CHECK (image_path IS NULL OR char_length(image_path) <= 300),
  external_url text CHECK (external_url IS NULL OR (char_length(external_url) <= 500 AND external_url ~ '^https://')),
  quantity_total integer,
  quota_amount numeric(12,2),
  quota_total integer,
  suggested_amount numeric(12,2) CHECK (suggested_amount IS NULL OR (suggested_amount > 0 AND suggested_amount <= 50000)),
  goal_amount numeric(12,2) CHECK (goal_amount IS NULL OR (goal_amount > 0 AND goal_amount <= 10000000)),
  is_visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  archived_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  CONSTRAINT wedding_gifts_kind_fields CHECK (
    (kind = 'physical' AND quantity_total BETWEEN 1 AND 1000 AND quota_amount IS NULL AND quota_total IS NULL AND goal_amount IS NULL)
    OR (kind = 'quota' AND quota_amount > 0 AND quota_amount <= 50000 AND quota_total BETWEEN 1 AND 1000 AND quantity_total IS NULL AND goal_amount IS NULL)
    OR (kind = 'fund' AND quantity_total IS NULL AND quota_amount IS NULL AND quota_total IS NULL)
  )
);
CREATE INDEX wedding_gifts_ws_idx ON public.wedding_gifts (workspace_id, sort_order);

CREATE TABLE public.wedding_gift_pledges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  gift_id uuid NOT NULL,
  invitation_id uuid NOT NULL,
  units integer CHECK (units IS NULL OR units BETWEEN 1 AND 100),
  amount numeric(12,2) CHECK (amount IS NULL OR (amount > 0 AND amount <= 50000)),
  message text CHECK (message IS NULL OR char_length(message) <= 500),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','confirmed','cancelled','expired')),
  expires_at timestamptz NOT NULL,
  confirmed_by uuid,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by_kind text CHECK (cancelled_by_kind IS NULL OR cancelled_by_kind IN ('guest','couple')),
  cancel_reason text CHECK (cancel_reason IS NULL OR char_length(cancel_reason) <= 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wedding_gift_pledges_value CHECK (units IS NOT NULL OR amount IS NOT NULL),
  FOREIGN KEY (workspace_id, gift_id) REFERENCES public.wedding_gifts(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, invitation_id) REFERENCES public.wedding_invitations(workspace_id, id) ON DELETE CASCADE
);
CREATE INDEX wedding_gift_pledges_gift_idx ON public.wedding_gift_pledges (gift_id, state);
CREATE INDEX wedding_gift_pledges_inv_idx ON public.wedding_gift_pledges (invitation_id, created_at);

CREATE TABLE public.wedding_gift_settings (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  portal_enabled boolean NOT NULL DEFAULT false,
  pending_days integer NOT NULL DEFAULT 15 CHECK (pending_days BETWEEN 1 AND 90),
  anonymity text NOT NULL DEFAULT 'couple' CHECK (anonymity IN ('couple')),
  pix_key_type text CHECK (pix_key_type IS NULL OR pix_key_type IN ('cpf','cnpj','email','phone','random')),
  pix_key text CHECK (pix_key IS NULL OR char_length(pix_key) <= 120),
  pix_receiver_name text CHECK (pix_receiver_name IS NULL OR char_length(pix_receiver_name) <= 120),
  instructions text CHECK (instructions IS NULL OR char_length(instructions) <= 1500),
  delivery_instructions text CHECK (delivery_instructions IS NULL OR char_length(delivery_instructions) <= 1500),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wedding_guest_audit ADD COLUMN IF NOT EXISTS gift_id uuid;
ALTER TABLE public.wedding_guest_audit ADD COLUMN IF NOT EXISTS pledge_id uuid;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wedding_gifts TO authenticated;
GRANT SELECT ON public.wedding_gift_pledges TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.wedding_gift_settings TO authenticated;
GRANT ALL ON public.wedding_gifts, public.wedding_gift_pledges, public.wedding_gift_settings TO service_role;

ALTER TABLE public.wedding_gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wedding_gift_pledges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wedding_gift_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY wedding_gifts_select ON public.wedding_gifts FOR SELECT TO authenticated USING (public.user_is_workspace_member(workspace_id));
CREATE POLICY wedding_gifts_insert ON public.wedding_gifts FOR INSERT TO authenticated WITH CHECK (public.user_is_workspace_member(workspace_id) AND created_by = auth.uid());
CREATE POLICY wedding_gifts_update ON public.wedding_gifts FOR UPDATE TO authenticated USING (public.user_is_workspace_member(workspace_id)) WITH CHECK (public.user_is_workspace_member(workspace_id));
CREATE POLICY wedding_gifts_delete ON public.wedding_gifts FOR DELETE TO authenticated USING (public.user_is_workspace_member(workspace_id));
CREATE POLICY wedding_gift_pledges_select ON public.wedding_gift_pledges FOR SELECT TO authenticated USING (public.user_is_workspace_member(workspace_id));
CREATE POLICY wedding_gift_settings_select ON public.wedding_gift_settings FOR SELECT TO authenticated USING (public.user_is_workspace_member(workspace_id));
CREATE POLICY wedding_gift_settings_insert ON public.wedding_gift_settings FOR INSERT TO authenticated WITH CHECK (public.user_is_workspace_member(workspace_id) AND created_by = auth.uid());
CREATE POLICY wedding_gift_settings_update ON public.wedding_gift_settings FOR UPDATE TO authenticated USING (public.user_is_workspace_member(workspace_id)) WITH CHECK (public.user_is_workspace_member(workspace_id));

-- Tipo e identidade do presente não mudam depois de criado (reservas dependem deles).
CREATE OR REPLACE FUNCTION public.wedding_gift_protect() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.workspace_id := OLD.workspace_id;
  NEW.kind := OLD.kind;
  NEW.created_by := OLD.created_by;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.wedding_gift_protect() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER wedding_gifts_protect BEFORE UPDATE ON public.wedding_gifts FOR EACH ROW EXECUTE FUNCTION public.wedding_gift_protect();

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['wedding_gifts','wedding_gift_pledges','wedding_gift_settings'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t || '_updated_at', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF workspace_id ON public.%I FOR EACH ROW EXECUTE FUNCTION public.wedding_block_demo()', t || '_no_demo', t);
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.emit_workspace_sync_event()', t || '_sync', t);
  END LOOP;
END $$;