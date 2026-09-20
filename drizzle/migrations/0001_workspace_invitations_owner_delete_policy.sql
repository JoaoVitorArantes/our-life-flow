-- Allow workspace owners to revoke (delete) invitations of their own workspace
DROP POLICY IF EXISTS workspace_invitations_owner_delete ON public.workspace_invitations;
CREATE POLICY workspace_invitations_owner_delete
ON public.workspace_invitations
FOR DELETE
TO authenticated
USING (public.is_workspace_owner(workspace_id));

GRANT DELETE ON public.workspace_invitations TO authenticated;