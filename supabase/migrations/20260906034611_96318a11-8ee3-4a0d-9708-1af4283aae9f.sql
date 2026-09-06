ALTER TABLE public.profiles ADD COLUMN active_workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;

CREATE TABLE public.workspace_relationships (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  started_at timestamptz,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACTIVE','PAUSED','ENDED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_relationships TO authenticated;
GRANT ALL ON public.workspace_relationships TO service_role;
ALTER TABLE public.workspace_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_relationships_select ON public.workspace_relationships FOR SELECT TO authenticated
  USING (public.user_is_workspace_member(workspace_id));
CREATE POLICY workspace_relationships_insert ON public.workspace_relationships FOR INSERT TO authenticated
  WITH CHECK (public.user_is_workspace_member(workspace_id));
CREATE POLICY workspace_relationships_update ON public.workspace_relationships FOR UPDATE TO authenticated
  USING (public.user_is_workspace_member(workspace_id))
  WITH CHECK (public.user_is_workspace_member(workspace_id));
CREATE POLICY workspace_relationships_delete ON public.workspace_relationships FOR DELETE TO authenticated
  USING (public.is_workspace_owner(workspace_id));
CREATE TRIGGER workspace_relationships_updated BEFORE UPDATE ON public.workspace_relationships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.workspace_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  invited_by uuid NOT NULL,
  email text NOT NULL,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACCEPTED','DECLINED','EXPIRED','CANCELLED')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_invitations TO authenticated;
GRANT ALL ON public.workspace_invitations TO service_role;
ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX workspace_invitations_one_pending_email
  ON public.workspace_invitations (workspace_id, lower(email)) WHERE status = 'PENDING';
CREATE INDEX workspace_invitations_email_status_idx
  ON public.workspace_invitations (lower(email), status, expires_at DESC);
CREATE POLICY workspace_invitations_select ON public.workspace_invitations FOR SELECT TO authenticated
  USING (
    public.user_is_workspace_member(workspace_id)
    OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
CREATE POLICY workspace_invitations_cancel ON public.workspace_invitations FOR UPDATE TO authenticated
  USING (public.is_workspace_owner(workspace_id) OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  WITH CHECK (public.is_workspace_owner(workspace_id) OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
CREATE TRIGGER workspace_invitations_updated BEFORE UPDATE ON public.workspace_invitations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_workspace_member_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.workspace_id::text, 0));
  IF EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = NEW.workspace_id AND user_id = NEW.user_id
  ) THEN
    RETURN NEW;
  END IF;
  IF (SELECT count(*) FROM public.workspace_members WHERE workspace_id = NEW.workspace_id) >= 2 THEN
    RAISE EXCEPTION 'Este workspace já possui duas pessoas.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.enforce_workspace_member_limit() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_workspace_member_limit() TO service_role;
CREATE TRIGGER workspace_members_limit_before_insert
  BEFORE INSERT ON public.workspace_members FOR EACH ROW
  EXECUTE FUNCTION public.enforce_workspace_member_limit();

CREATE OR REPLACE FUNCTION public.create_partner_invitation(_workspace_id uuid, _email text)
RETURNS TABLE(invitation_id uuid, invitation_token uuid, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _normalized_email text := lower(trim(_email));
  _invitation public.workspace_invitations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF NOT public.is_workspace_owner(_workspace_id) THEN RAISE EXCEPTION 'Somente o responsável pode convidar.'; END IF;
  IF _normalized_email = '' OR _normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'E-mail inválido.';
  END IF;
  IF _normalized_email = lower(coalesce(auth.jwt() ->> 'email', '')) THEN RAISE EXCEPTION 'Use o e-mail do seu parceiro ou parceira.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_workspace_id::text, 0));
  IF (SELECT count(*) FROM public.workspace_members WHERE workspace_id = _workspace_id) >= 2 THEN
    RAISE EXCEPTION 'Este workspace já possui duas pessoas.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.profiles p JOIN public.workspace_members m ON m.user_id = p.id
    WHERE m.workspace_id = _workspace_id AND lower(coalesce(p.email,'')) = _normalized_email
  ) THEN
    RAISE EXCEPTION 'Essa pessoa já participa deste workspace.';
  END IF;
  UPDATE public.workspace_invitations SET status = 'EXPIRED'
    WHERE workspace_id = _workspace_id AND status = 'PENDING' AND expires_at <= now();
  INSERT INTO public.workspace_invitations (workspace_id, invited_by, email)
  VALUES (_workspace_id, auth.uid(), _normalized_email)
  ON CONFLICT (workspace_id, lower(email)) WHERE status = 'PENDING'
  DO UPDATE SET invited_by = EXCLUDED.invited_by, token = gen_random_uuid(), expires_at = now() + interval '7 days', updated_at = now()
  RETURNING * INTO _invitation;
  RETURN QUERY SELECT _invitation.id, _invitation.token, _invitation.expires_at;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_partner_invitation(uuid,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_partner_invitation(uuid,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.respond_partner_invitation(_token uuid, _accept boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _invitation public.workspace_invitations%ROWTYPE;
  _email text := lower(coalesce(auth.jwt() ->> 'email', ''));
BEGIN
  IF auth.uid() IS NULL OR _email = '' THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT * INTO _invitation FROM public.workspace_invitations WHERE token = _token FOR UPDATE;
  IF NOT FOUND OR lower(_invitation.email) <> _email THEN RAISE EXCEPTION 'Convite não encontrado para esta conta.'; END IF;
  IF _invitation.status <> 'PENDING' THEN RAISE EXCEPTION 'Este convite não está mais pendente.'; END IF;
  IF _invitation.expires_at <= now() THEN
    UPDATE public.workspace_invitations SET status = 'EXPIRED', responded_at = now() WHERE id = _invitation.id;
    RAISE EXCEPTION 'Este convite expirou.';
  END IF;
  IF NOT _accept THEN
    UPDATE public.workspace_invitations SET status = 'DECLINED', responded_at = now() WHERE id = _invitation.id;
    RETURN _invitation.workspace_id;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_invitation.workspace_id::text, 0));
  IF (SELECT count(*) FROM public.workspace_members WHERE workspace_id = _invitation.workspace_id) >= 2 THEN
    RAISE EXCEPTION 'Este workspace já possui duas pessoas.';
  END IF;
  INSERT INTO public.profiles (id, name, email)
  VALUES (auth.uid(), split_part(_email, '@', 1), _email)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (_invitation.workspace_id, auth.uid(), 'MEMBER')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;
  UPDATE public.profiles SET active_workspace_id = _invitation.workspace_id WHERE id = auth.uid();
  UPDATE public.workspace_invitations SET status = 'ACCEPTED', responded_at = now() WHERE id = _invitation.id;
  UPDATE public.workspace_invitations SET status = 'CANCELLED', responded_at = now()
    WHERE workspace_id = _invitation.workspace_id AND id <> _invitation.id AND status = 'PENDING';
  INSERT INTO public.workspace_relationships (workspace_id, status)
  VALUES (_invitation.workspace_id, 'PENDING') ON CONFLICT (workspace_id) DO NOTHING;
  RETURN _invitation.workspace_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.respond_partner_invitation(uuid,boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.respond_partner_invitation(uuid,boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_active_workspace(_workspace_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.user_is_workspace_member(_workspace_id) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  UPDATE public.profiles SET active_workspace_id = _workspace_id WHERE id = auth.uid();
  RETURN _workspace_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_active_workspace(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_active_workspace(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.bootstrap_account(_name text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _ws uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_uid::text, 0));
  SELECT email INTO _email FROM auth.users WHERE id = _uid;
  INSERT INTO public.profiles (id, name, email)
  VALUES (_uid, coalesce(nullif(_name,''), split_part(coalesce(_email,'you@lifeos'),'@',1)), _email)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email,
    name = CASE WHEN public.profiles.name = '' THEN EXCLUDED.name ELSE public.profiles.name END;
  SELECT p.active_workspace_id INTO _ws FROM public.profiles p
    WHERE p.id = _uid AND EXISTS (
      SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = p.active_workspace_id AND m.user_id = _uid
    );
  IF _ws IS NULL THEN
    SELECT m.workspace_id INTO _ws FROM public.workspace_members m
      WHERE m.user_id = _uid ORDER BY m.created_at LIMIT 1;
  END IF;
  IF _ws IS NULL THEN
    INSERT INTO public.workspaces (name, owner_id) VALUES ('Life OS', _uid) RETURNING id INTO _ws;
    INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES (_ws, _uid, 'OWNER');
  END IF;
  UPDATE public.profiles SET active_workspace_id = _ws WHERE id = _uid;
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE workspace_id = _ws) THEN
    INSERT INTO public.categories (workspace_id, name, icon, color, type) VALUES
      (_ws,'Alimentação','utensils','#F59E0B','EXPENSE'),(_ws,'Transporte','car','#3B82F6','EXPENSE'),
      (_ws,'Moradia','home','#8B5CF6','EXPENSE'),(_ws,'Faculdade','graduation-cap','#06B6D4','EXPENSE'),
      (_ws,'Lazer','sparkles','#EC4899','EXPENSE'),(_ws,'Saúde','heart-pulse','#EF4444','EXPENSE'),
      (_ws,'Casal','heart','#F43F5E','BOTH'),(_ws,'Dívidas','trending-down','#DC2626','EXPENSE'),
      (_ws,'Investimentos','line-chart','#10B981','BOTH'),(_ws,'Salário','wallet','#22C55E','INCOME'),
      (_ws,'Outros','circle-dot','#94A3B8','BOTH');
  END IF;
  RETURN _ws;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.bootstrap_account(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_account(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.prevent_workspace_move()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN RAISE EXCEPTION 'Não é permitido mover dados entre workspaces.'; END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.prevent_workspace_move() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_workspace_move() TO service_role;

DO $$
DECLARE _table text;
BEGIN
  FOREACH _table IN ARRAY ARRAY['accounts','cards','categories','contexts','events','financings','goals','installment_plans','loans','notes','recurring_transactions','settlements','tasks','transactions','workspace_relationships']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS prevent_workspace_move ON public.%I', _table);
    EXECUTE format('CREATE TRIGGER prevent_workspace_move BEFORE UPDATE OF workspace_id ON public.%I FOR EACH ROW EXECUTE FUNCTION public.prevent_workspace_move()', _table);
  END LOOP;
END $$;

DO $$
DECLARE _table text;
BEGIN
  FOREACH _table IN ARRAY ARRAY['accounts','cards','categories','contexts','events','financings','goals','installment_plans','loans','notes','recurring_transactions','settlements','tasks','transactions']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', _table || '_workspace_all', _table);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.user_is_workspace_member(workspace_id)) WITH CHECK (public.user_is_workspace_member(workspace_id))', _table || '_workspace_all', _table);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.validate_workspace_references()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _ok boolean;
BEGIN
  IF TG_TABLE_NAME = 'cards' AND NEW.payment_account_id IS NOT NULL THEN
    SELECT workspace_id = NEW.workspace_id INTO _ok FROM public.accounts WHERE id = NEW.payment_account_id;
    IF NOT coalesce(_ok,false) THEN RAISE EXCEPTION 'Conta de pagamento pertence a outro workspace.'; END IF;
  ELSIF TG_TABLE_NAME = 'transactions' THEN
    IF NEW.category_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.categories WHERE id=NEW.category_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Categoria pertence a outro workspace.'; END IF;
    IF NEW.account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.accounts WHERE id=NEW.account_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Conta pertence a outro workspace.'; END IF;
    IF NEW.card_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.cards WHERE id=NEW.card_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Cartão pertence a outro workspace.'; END IF;
    IF NEW.source_account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.accounts WHERE id=NEW.source_account_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Conta de origem pertence a outro workspace.'; END IF;
    IF NEW.destination_account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.accounts WHERE id=NEW.destination_account_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Conta de destino pertence a outro workspace.'; END IF;
    IF NEW.context_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.contexts WHERE id=NEW.context_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Contexto pertence a outro workspace.'; END IF;
    IF NEW.installment_plan_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.installment_plans WHERE id=NEW.installment_plan_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Parcelamento pertence a outro workspace.'; END IF;
    IF NEW.recurring_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.recurring_transactions WHERE id=NEW.recurring_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Recorrência pertence a outro workspace.'; END IF;
    IF NEW.loan_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.loans WHERE id=NEW.loan_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Empréstimo pertence a outro workspace.'; END IF;
    IF NEW.financing_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.financings WHERE id=NEW.financing_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Financiamento pertence a outro workspace.'; END IF;
  ELSIF TG_TABLE_NAME IN ('events','goals','notes','tasks') AND NEW.context_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.contexts WHERE id=NEW.context_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Contexto pertence a outro workspace.'; END IF;
  ELSIF TG_TABLE_NAME = 'recurring_transactions' THEN
    IF NEW.category_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.categories WHERE id=NEW.category_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Categoria pertence a outro workspace.'; END IF;
    IF NEW.account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.accounts WHERE id=NEW.account_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Conta pertence a outro workspace.'; END IF;
    IF NEW.card_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.cards WHERE id=NEW.card_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Cartão pertence a outro workspace.'; END IF;
    IF NEW.context_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.contexts WHERE id=NEW.context_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Contexto pertence a outro workspace.'; END IF;
  ELSIF TG_TABLE_NAME IN ('financings','installment_plans') THEN
    IF NEW.category_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.categories WHERE id=NEW.category_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Categoria pertence a outro workspace.'; END IF;
    IF NEW.account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.accounts WHERE id=NEW.account_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Conta pertence a outro workspace.'; END IF;
    IF NEW.context_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.contexts WHERE id=NEW.context_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Contexto pertence a outro workspace.'; END IF;
    IF TG_TABLE_NAME = 'installment_plans' AND NEW.card_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.cards WHERE id=NEW.card_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Cartão pertence a outro workspace.'; END IF;
  ELSIF TG_TABLE_NAME = 'loans' THEN
    IF NEW.account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.accounts WHERE id=NEW.account_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Conta pertence a outro workspace.'; END IF;
    IF NEW.context_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.contexts WHERE id=NEW.context_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Contexto pertence a outro workspace.'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.validate_workspace_references() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_workspace_references() TO service_role;

DO $$
DECLARE _table text;
BEGIN
  FOREACH _table IN ARRAY ARRAY['cards','transactions','events','goals','notes','tasks','recurring_transactions','financings','installment_plans','loans']
  LOOP
    EXECUTE format('CREATE TRIGGER validate_workspace_references BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.validate_workspace_references()', _table);
  END LOOP;
END $$;

INSERT INTO public.workspace_relationships (workspace_id, started_at, status)
SELECT w.id, timestamptz '2023-09-17 00:00:00-03', 'ACTIVE'
FROM public.workspaces w
WHERE (SELECT count(*) FROM public.workspace_members m WHERE m.workspace_id = w.id) = 2
  AND (SELECT count(*) FROM public.transactions t WHERE t.workspace_id = w.id) > 0
ON CONFLICT (workspace_id) DO NOTHING;