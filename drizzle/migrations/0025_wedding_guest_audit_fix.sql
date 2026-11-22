CREATE OR REPLACE FUNCTION public.wedding_guest_audit_trg() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _portal boolean := coalesce(current_setting('wedding.portal', true), '') = 'on';
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