CREATE TABLE public.wedding_portal_secret (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  salt text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.wedding_portal_secret TO service_role;
ALTER TABLE public.wedding_portal_secret ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wedding_portal_secret FROM anon, authenticated;

ALTER TABLE public.wedding_public_content ADD COLUMN IF NOT EXISTS allow_rsvp_edit boolean NOT NULL DEFAULT true;

-- Membros não leem os hashes de link/código (somente as funções definer).
REVOKE SELECT ON public.wedding_invitations FROM authenticated;
GRANT SELECT (id, workspace_id, kind, label, max_companions, status, link_issued_at, expires_at, revoked_at, rsvp_locked, responded_at, created_by, created_at, updated_at) ON public.wedding_invitations TO authenticated;

REVOKE ALL ON FUNCTION public.wedding_hash(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wedding_normalize_code(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wedding_protect_invitation_secrets() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wedding_checkin_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wedding_guest_audit_trg() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.wedding_portal_resolve(_cred text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _key text; _id uuid; _fails int; _origin text; _h json; _salt text;
BEGIN
  SELECT salt INTO _salt FROM public.wedding_portal_secret WHERE id;
  IF _salt IS NULL THEN
    INSERT INTO public.wedding_portal_secret (id, salt) VALUES (true, encode(extensions.gen_random_bytes(32), 'hex')) ON CONFLICT (id) DO NOTHING;
    SELECT salt INTO _salt FROM public.wedding_portal_secret WHERE id;
  END IF;
  _h := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json;
  _origin := coalesce(nullif(btrim(_h->>'cf-connecting-ip'), ''), nullif(btrim(_h->>'x-real-ip'), ''),
    nullif(btrim(split_part(coalesce(_h->>'x-forwarded-for', ''), ',', 1)), ''), 'unknown');
  -- Nunca guarda a origem pura: HMAC com segredo interno.
  _key := encode(extensions.hmac(_origin, _salt, 'sha256'), 'hex');
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
    DELETE FROM public.wedding_portal_attempts WHERE created_at < now() - interval '1 hour';
  END IF;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.wedding_portal_resolve(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.wedding_invitation_locked(_inv uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.rsvp_locked OR (i.responded_at IS NOT NULL AND NOT coalesce(
    (SELECT c.allow_rsvp_edit FROM public.wedding_public_content c WHERE c.workspace_id = i.workspace_id), true))
  FROM public.wedding_invitations i WHERE i.id = _inv
$$;
REVOKE ALL ON FUNCTION public.wedding_invitation_locked(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.wedding_portal_payload(_inv uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'ok', true,
    'invitation', jsonb_build_object('label', i.label, 'kind', i.kind, 'max_companions', i.max_companions,
      'locked', public.wedding_invitation_locked(i.id), 'responded_at', i.responded_at),
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

CREATE OR REPLACE FUNCTION public.wedding_portal_rsvp(_cred text, _responses jsonb, _companions jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _inv public.wedding_invitations; _id uuid; r jsonb; n text; _kept int; _new int; _any_yes boolean; _recent int;
BEGIN
  _id := public.wedding_portal_resolve(_cred);
  IF _id IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  SELECT * INTO _inv FROM public.wedding_invitations WHERE id = _id FOR UPDATE;
  IF public.wedding_invitation_locked(_id) THEN RETURN jsonb_build_object('ok', false, 'error', 'locked'); END IF;
  SELECT count(*) INTO _recent FROM public.wedding_guest_audit WHERE invitation_id = _id AND via_portal AND created_at > now() - interval '1 hour';
  IF _recent >= 100 THEN RETURN jsonb_build_object('ok', false, 'error', 'too_many'); END IF;
  IF jsonb_typeof(coalesce(_responses, '[]')) <> 'array' OR jsonb_typeof(coalesce(_companions, '[]')) <> 'array'
     OR jsonb_array_length(coalesce(_responses, '[]')) > 50 OR jsonb_array_length(coalesce(_companions, '[]')) > 20
     OR octet_length(coalesce(_responses, '[]')::text) > 40000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid');
  END IF;
  PERFORM set_config('wedding.portal', 'on', true);
  FOR r IN SELECT * FROM jsonb_array_elements(coalesce(_responses, '[]')) LOOP
    IF jsonb_typeof(r) <> 'object' OR coalesce(r->>'rsvp', '') NOT IN ('yes','no')
       OR coalesce(r->>'id', '') !~ '^[0-9a-fA-F-]{36}$' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid');
    END IF;
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
REVOKE ALL ON FUNCTION public.wedding_portal_rsvp(text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wedding_portal_rsvp(text, jsonb, jsonb) TO anon, authenticated;