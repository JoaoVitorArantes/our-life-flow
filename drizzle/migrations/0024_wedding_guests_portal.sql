CREATE TABLE public.wedding_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'individual' CHECK (kind IN ('individual','group')),
  label text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 120),
  max_companions integer NOT NULL DEFAULT 0 CHECK (max_companions BETWEEN 0 AND 20),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','responded','revoked')),
  token_hash text UNIQUE,
  code_hash text UNIQUE,
  link_issued_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  rsvp_locked boolean NOT NULL DEFAULT false,
  responded_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id)
);

CREATE TABLE public.wedding_guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  invitation_id uuid,
  group_label text CHECK (group_label IS NULL OR char_length(group_label) <= 80),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  contact text CHECK (contact IS NULL OR char_length(contact) <= 160),
  dietary text CHECK (dietary IS NULL OR char_length(dietary) <= 300),
  accessibility text CHECK (accessibility IS NULL OR char_length(accessibility) <= 300),
  internal_notes text CHECK (internal_notes IS NULL OR char_length(internal_notes) <= 1000),
  is_companion boolean NOT NULL DEFAULT false,
  rsvp text NOT NULL DEFAULT 'pending' CHECK (rsvp IN ('pending','yes','no')),
  responded_at timestamptz,
  archived_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  FOREIGN KEY (workspace_id, invitation_id) REFERENCES public.wedding_invitations(workspace_id, id) ON DELETE SET NULL (invitation_id)
);
CREATE INDEX wedding_guests_inv_idx ON public.wedding_guests (workspace_id, invitation_id);

CREATE TABLE public.wedding_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  guest_id uuid NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now(),
  operator_id uuid NOT NULL,
  undone_at timestamptz,
  undone_by uuid,
  undo_reason text CHECK (undo_reason IS NULL OR char_length(undo_reason) <= 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (workspace_id, guest_id) REFERENCES public.wedding_guests(workspace_id, id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX wedding_checkins_one_active ON public.wedding_checkins (guest_id) WHERE undone_at IS NULL;

CREATE TABLE public.wedding_guest_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  invitation_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 1000),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (workspace_id, invitation_id) REFERENCES public.wedding_invitations(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE public.wedding_public_content (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  published boolean NOT NULL DEFAULT false,
  headline text CHECK (headline IS NULL OR char_length(headline) <= 160),
  message text CHECK (message IS NULL OR char_length(message) <= 2000),
  event_date date,
  event_time text CHECK (event_time IS NULL OR char_length(event_time) <= 60),
  venue text CHECK (venue IS NULL OR char_length(venue) <= 160),
  address text CHECK (address IS NULL OR char_length(address) <= 300),
  map_url text CHECK (map_url IS NULL OR map_url ~ '^https://'),
  guidance text CHECK (guidance IS NULL OR char_length(guidance) <= 2000),
  rsvp_deadline date,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.wedding_guest_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  invitation_id uuid,
  guest_id uuid,
  action text NOT NULL,
  actor_id uuid,
  via_portal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wedding_guest_audit_ws_idx ON public.wedding_guest_audit (workspace_id, created_at DESC);

CREATE TABLE public.wedding_portal_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wedding_portal_attempts_idx ON public.wedding_portal_attempts (key_hash, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wedding_invitations, public.wedding_guests, public.wedding_public_content TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.wedding_checkins TO authenticated;
GRANT SELECT, UPDATE, DELETE ON public.wedding_guest_messages TO authenticated;
GRANT SELECT ON public.wedding_guest_audit TO authenticated;
GRANT ALL ON public.wedding_invitations, public.wedding_guests, public.wedding_checkins, public.wedding_guest_messages, public.wedding_public_content, public.wedding_guest_audit, public.wedding_portal_attempts TO service_role;

ALTER TABLE public.wedding_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wedding_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wedding_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wedding_guest_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wedding_public_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wedding_guest_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wedding_portal_attempts ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['wedding_invitations','wedding_guests','wedding_public_content'] LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.user_is_workspace_member(workspace_id))', t || '_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.user_is_workspace_member(workspace_id) AND created_by = auth.uid())', t || '_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.user_is_workspace_member(workspace_id)) WITH CHECK (public.user_is_workspace_member(workspace_id))', t || '_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.user_is_workspace_member(workspace_id))', t || '_delete', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t || '_updated_at', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['wedding_invitations','wedding_guests','wedding_public_content','wedding_checkins','wedding_guest_messages'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF workspace_id ON public.%I FOR EACH ROW EXECUTE FUNCTION public.wedding_block_demo()', t || '_no_demo', t);
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.emit_workspace_sync_event()', t || '_sync', t);
  END LOOP;
END $$;

CREATE POLICY wedding_checkins_select ON public.wedding_checkins FOR SELECT TO authenticated USING (public.user_is_workspace_member(workspace_id));
CREATE POLICY wedding_checkins_insert ON public.wedding_checkins FOR INSERT TO authenticated WITH CHECK (public.user_is_workspace_member(workspace_id) AND operator_id = auth.uid() AND undone_at IS NULL);
CREATE POLICY wedding_checkins_update ON public.wedding_checkins FOR UPDATE TO authenticated USING (public.user_is_workspace_member(workspace_id)) WITH CHECK (public.user_is_workspace_member(workspace_id) AND undone_by = auth.uid() AND undo_reason IS NOT NULL);
CREATE POLICY wedding_messages_select ON public.wedding_guest_messages FOR SELECT TO authenticated USING (public.user_is_workspace_member(workspace_id));
CREATE POLICY wedding_messages_update ON public.wedding_guest_messages FOR UPDATE TO authenticated USING (public.user_is_workspace_member(workspace_id)) WITH CHECK (public.user_is_workspace_member(workspace_id));
CREATE POLICY wedding_messages_delete ON public.wedding_guest_messages FOR DELETE TO authenticated USING (public.user_is_workspace_member(workspace_id));
CREATE POLICY wedding_guest_audit_select ON public.wedding_guest_audit FOR SELECT TO authenticated USING (public.user_is_workspace_member(workspace_id));

CREATE OR REPLACE FUNCTION public.wedding_protect_invitation_secrets() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_setting('wedding.issuing', true) = 'on' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.token_hash := NULL; NEW.code_hash := NULL; NEW.link_issued_at := NULL;
  ELSE
    NEW.token_hash := OLD.token_hash; NEW.code_hash := OLD.code_hash; NEW.link_issued_at := OLD.link_issued_at;
    NEW.workspace_id := OLD.workspace_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER wedding_invitations_secrets BEFORE INSERT OR UPDATE ON public.wedding_invitations FOR EACH ROW EXECUTE FUNCTION public.wedding_protect_invitation_secrets();

CREATE OR REPLACE FUNCTION public.wedding_checkin_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (SELECT 1 FROM public.wedding_guests g WHERE g.id = NEW.guest_id AND g.workspace_id = NEW.workspace_id AND g.archived_at IS NULL) THEN
      RAISE EXCEPTION 'Convidado indisponível para check-in';
    END IF;
    NEW.checked_at := now();
  ELSE
    IF OLD.undone_at IS NOT NULL THEN RAISE EXCEPTION 'Check-in já desfeito'; END IF;
    NEW.guest_id := OLD.guest_id; NEW.workspace_id := OLD.workspace_id; NEW.checked_at := OLD.checked_at; NEW.operator_id := OLD.operator_id;
    NEW.undone_at := now();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER wedding_checkins_guard BEFORE INSERT OR UPDATE ON public.wedding_checkins FOR EACH ROW EXECUTE FUNCTION public.wedding_checkin_guard();

CREATE OR REPLACE FUNCTION public.wedding_guest_audit_trg() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _portal boolean := current_setting('wedding.portal', true) = 'on';
BEGIN
  IF TG_TABLE_NAME = 'wedding_checkins' THEN
    INSERT INTO public.wedding_guest_audit (workspace_id, guest_id, action, actor_id)
    VALUES (NEW.workspace_id, NEW.guest_id, CASE WHEN TG_OP = 'INSERT' THEN 'checkin' ELSE 'checkin_undone' END, auth.uid());
  ELSIF TG_TABLE_NAME = 'wedding_guests' THEN
    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.wedding_guest_audit (workspace_id, invitation_id, guest_id, action, actor_id, via_portal)
      VALUES (NEW.workspace_id, NEW.invitation_id, NEW.id, 'guest_added', CASE WHEN _portal THEN NULL ELSE auth.uid() END, _portal);
    ELSIF NEW.rsvp IS DISTINCT FROM OLD.rsvp THEN
      INSERT INTO public.wedding_guest_audit (workspace_id, invitation_id, guest_id, action, actor_id, via_portal)
      VALUES (NEW.workspace_id, NEW.invitation_id, NEW.id, 'rsvp_' || NEW.rsvp, CASE WHEN _portal THEN NULL ELSE auth.uid() END, _portal);
    END IF;
  ELSIF TG_TABLE_NAME = 'wedding_invitations' THEN
    IF TG_OP = 'UPDATE' AND NEW.revoked_at IS NOT NULL AND OLD.revoked_at IS NULL THEN
      INSERT INTO public.wedding_guest_audit (workspace_id, invitation_id, action, actor_id) VALUES (NEW.workspace_id, NEW.id, 'link_revoked', auth.uid());
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER wedding_checkins_audit AFTER INSERT OR UPDATE ON public.wedding_checkins FOR EACH ROW EXECUTE FUNCTION public.wedding_guest_audit_trg();
CREATE TRIGGER wedding_guests_audit AFTER INSERT OR UPDATE OF rsvp ON public.wedding_guests FOR EACH ROW EXECUTE FUNCTION public.wedding_guest_audit_trg();
CREATE TRIGGER wedding_invitations_audit AFTER UPDATE OF revoked_at ON public.wedding_invitations FOR EACH ROW EXECUTE FUNCTION public.wedding_guest_audit_trg();

CREATE OR REPLACE FUNCTION public.wedding_hash(_v text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public, extensions AS $$
  SELECT encode(extensions.digest(_v, 'sha256'), 'hex')
$$;
CREATE OR REPLACE FUNCTION public.wedding_normalize_code(_v text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT upper(regexp_replace(coalesce(_v, ''), '[^A-Za-z0-9]', '', 'g'))
$$;

CREATE OR REPLACE FUNCTION public.wedding_issue_invitation_link(_invitation_id uuid)
RETURNS TABLE(token text, code text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _ws uuid; _token text; _code text := ''; _alpha text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; _b bytea; i int;
BEGIN
  SELECT workspace_id INTO _ws FROM public.wedding_invitations WHERE id = _invitation_id;
  IF _ws IS NULL OR NOT public.user_is_workspace_member(_ws) THEN RAISE EXCEPTION 'Convite não encontrado'; END IF;
  _token := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  _b := extensions.gen_random_bytes(8);
  FOR i IN 0..7 LOOP _code := _code || substr(_alpha, (get_byte(_b, i) % 31) + 1, 1); END LOOP;
  PERFORM set_config('wedding.issuing', 'on', true);
  UPDATE public.wedding_invitations SET token_hash = public.wedding_hash(_token), code_hash = public.wedding_hash(_code),
    link_issued_at = now(), revoked_at = NULL, status = CASE WHEN status IN ('draft','revoked') THEN 'sent' ELSE status END
  WHERE id = _invitation_id;
  PERFORM set_config('wedding.issuing', 'off', true);
  INSERT INTO public.wedding_guest_audit (workspace_id, invitation_id, action, actor_id) VALUES (_ws, _invitation_id, 'link_issued', auth.uid());
  token := _token; code := _code; RETURN NEXT;
END $$;
REVOKE ALL ON FUNCTION public.wedding_issue_invitation_link(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wedding_issue_invitation_link(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.wedding_portal_resolve(_cred text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _key text; _id uuid; _fails int; _ip text;
BEGIN
  _ip := coalesce(nullif(btrim(split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1)), ''), 'unknown');
  _key := public.wedding_hash('portal:' || _ip);
  SELECT count(*) INTO _fails FROM public.wedding_portal_attempts WHERE key_hash = _key AND created_at > now() - interval '15 minutes';
  IF _fails >= 30 THEN RETURN NULL; END IF;
  IF _cred IS NOT NULL AND char_length(_cred) BETWEEN 6 AND 100 THEN
    SELECT i.id INTO _id FROM public.wedding_invitations i
    JOIN public.workspaces w ON w.id = i.workspace_id AND NOT w.is_demo
    WHERE (i.token_hash = public.wedding_hash(_cred) OR i.code_hash = public.wedding_hash(public.wedding_normalize_code(_cred)))
      AND i.revoked_at IS NULL AND (i.expires_at IS NULL OR i.expires_at > now())
    LIMIT 1;
  END IF;
  IF _id IS NULL THEN
    INSERT INTO public.wedding_portal_attempts (key_hash) VALUES (_key);
    DELETE FROM public.wedding_portal_attempts WHERE created_at < now() - interval '1 day';
  END IF;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.wedding_portal_resolve(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.wedding_portal_payload(_inv uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'ok', true,
    'invitation', jsonb_build_object('label', i.label, 'kind', i.kind, 'max_companions', i.max_companions, 'locked', i.rsvp_locked, 'responded_at', i.responded_at),
    'couple', (SELECT p.couple_names FROM public.wedding_plans p WHERE p.workspace_id = i.workspace_id),
    'theme', (SELECT p.theme FROM public.wedding_plans p WHERE p.workspace_id = i.workspace_id),
    'guests', coalesce((SELECT jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'is_companion', g.is_companion, 'rsvp', g.rsvp,
        'dietary', g.dietary, 'accessibility', g.accessibility,
        'checked_in', EXISTS (SELECT 1 FROM public.wedding_checkins c WHERE c.guest_id = g.id AND c.undone_at IS NULL)) ORDER BY g.is_companion, g.created_at)
      FROM public.wedding_guests g WHERE g.invitation_id = i.id AND g.archived_at IS NULL), '[]'::jsonb),
    'content', (SELECT CASE WHEN c.published THEN jsonb_build_object('headline', c.headline, 'message', c.message, 'event_date', c.event_date,
        'event_time', c.event_time, 'venue', c.venue, 'address', c.address, 'map_url', c.map_url, 'guidance', c.guidance, 'rsvp_deadline', c.rsvp_deadline) END
      FROM public.wedding_public_content c WHERE c.workspace_id = i.workspace_id)
  ) FROM public.wedding_invitations i WHERE i.id = _inv
$$;
REVOKE ALL ON FUNCTION public.wedding_portal_payload(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.wedding_portal_get(_cred text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _inv uuid := public.wedding_portal_resolve(_cred);
BEGIN
  IF _inv IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  RETURN public.wedding_portal_payload(_inv);
END $$;

CREATE OR REPLACE FUNCTION public.wedding_portal_rsvp(_cred text, _responses jsonb, _companions jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _inv public.wedding_invitations; _id uuid; r jsonb; n text; _kept int; _new int; _any_yes boolean;
BEGIN
  _id := public.wedding_portal_resolve(_cred);
  IF _id IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  SELECT * INTO _inv FROM public.wedding_invitations WHERE id = _id FOR UPDATE;
  IF _inv.rsvp_locked THEN RETURN jsonb_build_object('ok', false, 'error', 'locked'); END IF;
  IF jsonb_typeof(coalesce(_responses, '[]')) <> 'array' OR jsonb_typeof(coalesce(_companions, '[]')) <> 'array'
     OR jsonb_array_length(coalesce(_responses, '[]')) > 50 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid');
  END IF;
  PERFORM set_config('wedding.portal', 'on', true);
  FOR r IN SELECT * FROM jsonb_array_elements(coalesce(_responses, '[]')) LOOP
    IF (r->>'rsvp') NOT IN ('yes','no') THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid'); END IF;
    UPDATE public.wedding_guests SET rsvp = r->>'rsvp', responded_at = now(),
      dietary = left(nullif(btrim(coalesce(r->>'dietary', '')), ''), 300),
      accessibility = left(nullif(btrim(coalesce(r->>'accessibility', '')), ''), 300)
    WHERE id = (r->>'id')::uuid AND invitation_id = _id AND archived_at IS NULL AND NOT is_companion;
  END LOOP;
  SELECT EXISTS (SELECT 1 FROM public.wedding_guests WHERE invitation_id = _id AND NOT is_companion AND archived_at IS NULL AND rsvp = 'yes') INTO _any_yes;
  DELETE FROM public.wedding_guests g WHERE g.invitation_id = _id AND g.is_companion
    AND NOT EXISTS (SELECT 1 FROM public.wedding_checkins c WHERE c.guest_id = g.id AND c.undone_at IS NULL);
  SELECT count(*) INTO _kept FROM public.wedding_guests WHERE invitation_id = _id AND is_companion AND archived_at IS NULL;
  _new := 0;
  IF _any_yes THEN
    FOR n IN SELECT btrim(value) FROM jsonb_array_elements_text(coalesce(_companions, '[]')) LOOP
      CONTINUE WHEN n = '';
      IF _kept + _new >= _inv.max_companions THEN
        RAISE EXCEPTION 'Limite de acompanhantes excedido' USING ERRCODE = 'P0001';
      END IF;
      INSERT INTO public.wedding_guests (workspace_id, invitation_id, name, is_companion, rsvp, responded_at, created_by)
      VALUES (_inv.workspace_id, _id, left(n, 120), true, 'yes', now(), _inv.created_by);
      _new := _new + 1;
    END LOOP;
  END IF;
  UPDATE public.wedding_invitations SET responded_at = now(), status = 'responded' WHERE id = _id;
  PERFORM set_config('wedding.portal', 'off', true);
  RETURN public.wedding_portal_payload(_id);
END $$;

CREATE OR REPLACE FUNCTION public.wedding_portal_message(_cred text, _body text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _ws uuid; _recent int;
BEGIN
  _id := public.wedding_portal_resolve(_cred);
  IF _id IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  IF _body IS NULL OR char_length(btrim(_body)) NOT BETWEEN 1 AND 1000 THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid'); END IF;
  SELECT workspace_id INTO _ws FROM public.wedding_invitations WHERE id = _id;
  SELECT count(*) INTO _recent FROM public.wedding_guest_messages WHERE invitation_id = _id AND created_at > now() - interval '1 hour';
  IF _recent >= 5 THEN RETURN jsonb_build_object('ok', false, 'error', 'too_many'); END IF;
  INSERT INTO public.wedding_guest_messages (workspace_id, invitation_id, body) VALUES (_ws, _id, btrim(_body));
  RETURN jsonb_build_object('ok', true);
END $$;

REVOKE ALL ON FUNCTION public.wedding_portal_get(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wedding_portal_rsvp(text, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wedding_portal_message(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wedding_portal_get(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wedding_portal_rsvp(text, jsonb, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wedding_portal_message(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.wedding_find_invitation(_workspace_id uuid, _cred text) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.id FROM public.wedding_invitations i
  WHERE public.user_is_workspace_member(_workspace_id) AND i.workspace_id = _workspace_id
    AND (i.token_hash = public.wedding_hash(_cred) OR i.code_hash = public.wedding_hash(public.wedding_normalize_code(_cred)))
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.wedding_find_invitation(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wedding_find_invitation(uuid, text) TO authenticated;