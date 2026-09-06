DROP POLICY IF EXISTS workspace_invitations_cancel ON public.workspace_invitations;
CREATE POLICY workspace_invitations_insert ON public.workspace_invitations FOR INSERT TO authenticated
  WITH CHECK (
    invited_by = auth.uid()
    AND public.is_workspace_owner(workspace_id)
    AND status = 'PENDING'
  );
CREATE POLICY workspace_invitations_owner_update ON public.workspace_invitations FOR UPDATE TO authenticated
  USING (public.is_workspace_owner(workspace_id))
  WITH CHECK (public.is_workspace_owner(workspace_id) AND status IN ('PENDING','CANCELLED','EXPIRED'));
CREATE POLICY workspace_invitations_recipient_update ON public.workspace_invitations FOR UPDATE TO authenticated
  USING (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  WITH CHECK (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    AND (
      status = 'DECLINED'
      OR (status = 'ACCEPTED' AND public.user_is_workspace_member(workspace_id))
    )
  );

CREATE OR REPLACE FUNCTION public.protect_invitation_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     OR NEW.invited_by IS DISTINCT FROM OLD.invited_by
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Os dados de identidade do convite não podem ser alterados.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.protect_invitation_identity() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_invitation_identity() TO service_role;
CREATE TRIGGER protect_invitation_identity_before_update
  BEFORE UPDATE ON public.workspace_invitations FOR EACH ROW
  EXECUTE FUNCTION public.protect_invitation_identity();

DROP POLICY IF EXISTS wm_insert ON public.workspace_members;
CREATE POLICY wm_insert ON public.workspace_members FOR INSERT TO authenticated
WITH CHECK (
  public.is_workspace_owner(workspace_id)
  OR (
    user_id = auth.uid()
    AND role = 'MEMBER'
    AND EXISTS (
      SELECT 1 FROM public.workspace_invitations i
      WHERE i.workspace_id = workspace_members.workspace_id
        AND lower(i.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        AND i.status = 'PENDING'
        AND i.expires_at > now()
    )
  )
);

ALTER FUNCTION public.create_partner_invitation(uuid,text) SECURITY INVOKER;
ALTER FUNCTION public.respond_partner_invitation(uuid,boolean) SECURITY INVOKER;
ALTER FUNCTION public.set_active_workspace(uuid) SECURITY INVOKER;