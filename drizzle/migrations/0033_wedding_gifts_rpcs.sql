CREATE OR REPLACE FUNCTION public.wedding_gift_used(_gift uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(sum(units), 0)::int FROM public.wedding_gift_pledges
  WHERE gift_id = _gift AND (state = 'confirmed' OR (state = 'pending' AND expires_at > now()))
$$;
REVOKE ALL ON FUNCTION public.wedding_gift_used(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.wedding_gift_sweep(_ws uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM set_config('wedding.system', 'on', true);
  UPDATE public.wedding_gift_pledges SET state = 'expired'
  WHERE workspace_id = _ws AND state = 'pending' AND expires_at <= now();
  PERFORM set_config('wedding.system', 'off', true);
END $$;
REVOKE ALL ON FUNCTION public.wedding_gift_sweep(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.wedding_gift_audit_trg() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _portal boolean := coalesce(current_setting('wedding.portal', true), '') = 'on';
        _system boolean := coalesce(current_setting('wedding.system', true), '') = 'on';
        _action text;
BEGIN
  IF TG_OP = 'INSERT' THEN _action := 'gift_pledged';
  ELSIF NEW.state IS DISTINCT FROM OLD.state THEN
    _action := CASE WHEN NEW.state = 'pending' THEN 'gift_reopened' ELSE 'gift_' || NEW.state END;
  ELSE RETURN NEW;
  END IF;
  INSERT INTO public.wedding_guest_audit (workspace_id, invitation_id, gift_id, pledge_id, action, actor_id, via_portal)
  VALUES (NEW.workspace_id, NEW.invitation_id, NEW.gift_id, NEW.id, _action,
          CASE WHEN _portal OR _system THEN NULL ELSE auth.uid() END, _portal);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.wedding_gift_audit_trg() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER wedding_gift_pledges_audit AFTER INSERT OR UPDATE OF state ON public.wedding_gift_pledges
  FOR EACH ROW EXECUTE FUNCTION public.wedding_gift_audit_trg();

CREATE OR REPLACE FUNCTION public.wedding_gift_block_delete() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.wedding_gift_pledges p WHERE p.gift_id = OLD.id) THEN
    RAISE EXCEPTION 'Este presente já tem reservas. Arquive em vez de excluir.' USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public.wedding_gift_block_delete() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER wedding_gifts_block_delete BEFORE DELETE ON public.wedding_gifts
  FOR EACH ROW EXECUTE FUNCTION public.wedding_gift_block_delete();

-- Dados do portal para um convite já validado (sem nomes, sem outros convites, sem progresso de fundos).
CREATE OR REPLACE FUNCTION public.wedding_portal_gifts_payload(_inv uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH i AS (SELECT id, workspace_id FROM public.wedding_invitations WHERE id = _inv),
  s AS (SELECT st.* FROM public.wedding_gift_settings st JOIN i ON st.workspace_id = i.workspace_id)
  SELECT jsonb_build_object(
    'ok', true,
    'enabled', coalesce((SELECT portal_enabled FROM s), false),
    'pending_days', coalesce((SELECT pending_days FROM s), 15),
    'gifts', CASE WHEN coalesce((SELECT portal_enabled FROM s), false) THEN coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', g.id, 'kind', g.kind, 'title', g.title, 'description', g.description, 'external_url', g.external_url,
        'quota_amount', CASE WHEN g.kind = 'quota' THEN g.quota_amount END,
        'suggested_amount', CASE WHEN g.kind = 'fund' THEN g.suggested_amount END,
        'total', CASE g.kind WHEN 'physical' THEN g.quantity_total WHEN 'quota' THEN g.quota_total END,
        'available', CASE WHEN g.kind = 'fund' THEN NULL
          ELSE greatest(0, coalesce(g.quantity_total, g.quota_total) - public.wedding_gift_used(g.id)) END
      ) ORDER BY g.sort_order, g.created_at)
      FROM public.wedding_gifts g JOIN i ON g.workspace_id = i.workspace_id
      WHERE g.is_visible AND g.archived_at IS NULL), '[]'::jsonb) ELSE '[]'::jsonb END,
    'my_pledges', CASE WHEN coalesce((SELECT portal_enabled FROM s), false) THEN coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'gift_title', g.title, 'kind', g.kind, 'units', p.units, 'amount', p.amount,
        'state', CASE WHEN p.state = 'pending' AND p.expires_at <= now() THEN 'expired' ELSE p.state END,
        'expires_at', p.expires_at, 'message', p.message, 'created_at', p.created_at
      ) ORDER BY p.created_at DESC)
      FROM public.wedding_gift_pledges p JOIN public.wedding_gifts g ON g.id = p.gift_id
      WHERE p.invitation_id = _inv), '[]'::jsonb) ELSE '[]'::jsonb END,
    'payment', CASE WHEN coalesce((SELECT portal_enabled FROM s), false) THEN (
      SELECT CASE WHEN coalesce(nullif(btrim(pix_key), ''), nullif(btrim(instructions), ''), nullif(btrim(delivery_instructions), '')) IS NULL THEN NULL
        ELSE jsonb_build_object(
          'pix_key_type', CASE WHEN nullif(btrim(pix_key), '') IS NOT NULL THEN pix_key_type END,
          'pix_key', nullif(btrim(pix_key), ''),
          'pix_receiver_name', CASE WHEN nullif(btrim(pix_key), '') IS NOT NULL THEN nullif(btrim(pix_receiver_name), '') END,
          'instructions', nullif(btrim(instructions), ''),
          'delivery_instructions', nullif(btrim(delivery_instructions), '')) END
      FROM s) END
  )
$$;
REVOKE ALL ON FUNCTION public.wedding_portal_gifts_payload(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.wedding_portal_gifts(_cred text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _inv uuid := public.wedding_portal_resolve(_cred); _ws uuid;
BEGIN
  IF _inv IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  SELECT workspace_id INTO _ws FROM public.wedding_invitations WHERE id = _inv;
  PERFORM public.wedding_gift_sweep(_ws);
  RETURN public.wedding_portal_gifts_payload(_inv);
END $$;

CREATE OR REPLACE FUNCTION public.wedding_portal_pledge(_cred text, _gift uuid, _units integer, _amount numeric, _message text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _inv uuid; _ws uuid; _g public.wedding_gifts; _s public.wedding_gift_settings; _recent int;
        _avail int; _u int; _a numeric(12,2); _msg text;
BEGIN
  _inv := public.wedding_portal_resolve(_cred);
  IF _inv IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  SELECT workspace_id INTO _ws FROM public.wedding_invitations WHERE id = _inv;
  SELECT * INTO _s FROM public.wedding_gift_settings WHERE workspace_id = _ws;
  IF _s.workspace_id IS NULL OR NOT _s.portal_enabled THEN RETURN jsonb_build_object('ok', false, 'error', 'disabled'); END IF;
  SELECT count(*) INTO _recent FROM public.wedding_gift_pledges WHERE invitation_id = _inv AND created_at > now() - interval '1 hour';
  IF _recent >= 10 THEN RETURN jsonb_build_object('ok', false, 'error', 'too_many'); END IF;
  _msg := nullif(btrim(coalesce(_message, '')), '');
  IF _msg IS NOT NULL AND (char_length(_msg) > 500 OR _msg ~ '[<>]') THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid'); END IF;

  SELECT * INTO _g FROM public.wedding_gifts
  WHERE id = _gift AND workspace_id = _ws AND is_visible AND archived_at IS NULL FOR UPDATE;
  IF _g.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid'); END IF;
  PERFORM public.wedding_gift_sweep(_ws);

  IF _g.kind = 'fund' THEN
    IF _amount IS NULL OR _amount <= 0 OR _amount > 50000 THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid'); END IF;
    _u := NULL; _a := round(_amount, 2);
  ELSE
    IF _units IS NULL OR _units < 1 OR _units > 100 THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid'); END IF;
    _avail := coalesce(_g.quantity_total, _g.quota_total) - public.wedding_gift_used(_g.id);
    IF _units > _avail THEN RETURN jsonb_build_object('ok', false, 'error', 'unavailable'); END IF;
    _u := _units;
    _a := CASE WHEN _g.kind = 'quota' THEN round(_units * _g.quota_amount, 2) END;
    IF _a IS NOT NULL AND _a > 50000 THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid'); END IF;
  END IF;

  PERFORM set_config('wedding.portal', 'on', true);
  INSERT INTO public.wedding_gift_pledges (workspace_id, gift_id, invitation_id, units, amount, message, expires_at)
  VALUES (_ws, _g.id, _inv, _u, _a, _msg, now() + make_interval(days => _s.pending_days));
  PERFORM set_config('wedding.portal', 'off', true);
  RETURN public.wedding_portal_gifts_payload(_inv);
END $$;

CREATE OR REPLACE FUNCTION public.wedding_portal_pledge_cancel(_cred text, _pledge uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _inv uuid; _n int;
BEGIN
  _inv := public.wedding_portal_resolve(_cred);
  IF _inv IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  PERFORM set_config('wedding.portal', 'on', true);
  UPDATE public.wedding_gift_pledges SET state = 'cancelled', cancelled_at = now(), cancelled_by_kind = 'guest'
  WHERE id = _pledge AND invitation_id = _inv AND state = 'pending' AND expires_at > now();
  GET DIAGNOSTICS _n = ROW_COUNT;
  PERFORM set_config('wedding.portal', 'off', true);
  IF _n = 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid'); END IF;
  RETURN public.wedding_portal_gifts_payload(_inv);
END $$;

REVOKE ALL ON FUNCTION public.wedding_portal_gifts(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wedding_portal_pledge(text, uuid, integer, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wedding_portal_pledge_cancel(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wedding_portal_gifts(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wedding_portal_pledge(text, uuid, integer, numeric, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wedding_portal_pledge_cancel(text, uuid) TO anon, authenticated;

-- Ações do casal (membros do espaço).
CREATE OR REPLACE FUNCTION public.wedding_gift_refresh(_workspace_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.user_is_workspace_member(_workspace_id) THEN RAISE EXCEPTION 'Sem acesso' USING ERRCODE = '42501'; END IF;
  PERFORM public.wedding_gift_sweep(_workspace_id);
END $$;

CREATE OR REPLACE FUNCTION public.wedding_gift_confirm(_pledge uuid, _amount numeric DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p public.wedding_gift_pledges; _kind text;
BEGIN
  SELECT * INTO _p FROM public.wedding_gift_pledges WHERE id = _pledge FOR UPDATE;
  IF _p.id IS NULL OR auth.uid() IS NULL OR NOT public.user_is_workspace_member(_p.workspace_id) THEN RAISE EXCEPTION 'Reserva não encontrada'; END IF;
  IF _p.state <> 'pending' OR _p.expires_at <= now() THEN
    RAISE EXCEPTION 'Só reservas pendentes no prazo podem ser confirmadas. Reabra a reserva antes.' USING ERRCODE = 'P0001';
  END IF;
  SELECT kind INTO _kind FROM public.wedding_gifts WHERE id = _p.gift_id;
  IF _amount IS NOT NULL THEN
    IF _kind <> 'fund' THEN RAISE EXCEPTION 'O valor só pode ser ajustado em fundos.' USING ERRCODE = 'P0001'; END IF;
    IF _amount <= 0 OR _amount > 50000 THEN RAISE EXCEPTION 'Valor inválido (máximo R$ 50.000,00).' USING ERRCODE = 'P0001'; END IF;
  END IF;
  UPDATE public.wedding_gift_pledges SET state = 'confirmed', confirmed_by = auth.uid(), confirmed_at = now(),
    amount = coalesce(round(_amount, 2), amount)
  WHERE id = _pledge;
END $$;

CREATE OR REPLACE FUNCTION public.wedding_gift_cancel(_pledge uuid, _reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p public.wedding_gift_pledges;
BEGIN
  SELECT * INTO _p FROM public.wedding_gift_pledges WHERE id = _pledge FOR UPDATE;
  IF _p.id IS NULL OR auth.uid() IS NULL OR NOT public.user_is_workspace_member(_p.workspace_id) THEN RAISE EXCEPTION 'Reserva não encontrada'; END IF;
  IF _p.state NOT IN ('pending','confirmed') THEN RAISE EXCEPTION 'Esta reserva já está encerrada.' USING ERRCODE = 'P0001'; END IF;
  IF _reason IS NULL OR char_length(btrim(_reason)) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Informe o motivo (até 200 caracteres).' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.wedding_gift_pledges SET state = 'cancelled', cancelled_at = now(), cancelled_by_kind = 'couple', cancel_reason = btrim(_reason)
  WHERE id = _pledge;
END $$;

CREATE OR REPLACE FUNCTION public.wedding_gift_reopen(_pledge uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p public.wedding_gift_pledges; _g public.wedding_gifts; _days int; _avail int;
BEGIN
  SELECT * INTO _p FROM public.wedding_gift_pledges WHERE id = _pledge;
  IF _p.id IS NULL OR auth.uid() IS NULL OR NOT public.user_is_workspace_member(_p.workspace_id) THEN RAISE EXCEPTION 'Reserva não encontrada'; END IF;
  SELECT * INTO _g FROM public.wedding_gifts WHERE id = _p.gift_id FOR UPDATE;
  SELECT * INTO _p FROM public.wedding_gift_pledges WHERE id = _pledge FOR UPDATE;
  PERFORM public.wedding_gift_sweep(_p.workspace_id);
  SELECT * INTO _p FROM public.wedding_gift_pledges WHERE id = _pledge;
  IF _p.state NOT IN ('cancelled','expired') THEN RAISE EXCEPTION 'Só reservas canceladas ou vencidas podem ser reabertas.' USING ERRCODE = 'P0001'; END IF;
  IF _g.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Restaure o presente antes de reabrir a reserva.' USING ERRCODE = 'P0001'; END IF;
  IF _g.kind <> 'fund' THEN
    _avail := coalesce(_g.quantity_total, _g.quota_total) - public.wedding_gift_used(_g.id);
    IF coalesce(_p.units, 0) > _avail THEN RAISE EXCEPTION 'Não há mais disponibilidade para reabrir esta reserva.' USING ERRCODE = 'P0001'; END IF;
  END IF;
  SELECT coalesce((SELECT pending_days FROM public.wedding_gift_settings WHERE workspace_id = _p.workspace_id), 15) INTO _days;
  UPDATE public.wedding_gift_pledges SET state = 'pending', expires_at = now() + make_interval(days => _days),
    cancelled_at = NULL, cancelled_by_kind = NULL, cancel_reason = NULL, confirmed_by = NULL, confirmed_at = NULL
  WHERE id = _pledge;
END $$;

REVOKE ALL ON FUNCTION public.wedding_gift_refresh(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.wedding_gift_confirm(uuid, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.wedding_gift_cancel(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.wedding_gift_reopen(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wedding_gift_refresh(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wedding_gift_confirm(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wedding_gift_cancel(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wedding_gift_reopen(uuid) TO authenticated;