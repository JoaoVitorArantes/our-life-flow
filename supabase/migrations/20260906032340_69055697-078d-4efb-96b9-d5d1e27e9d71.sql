ALTER TABLE public.workspaces ADD COLUMN avatar_url text;

DROP POLICY IF EXISTS "Workspace members can view workspace avatar" ON storage.objects;
CREATE POLICY "Workspace members can view workspace avatar"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'workspaces'
  AND (storage.foldername(name))[2] IS NOT NULL
  AND public.user_is_workspace_member(((storage.foldername(name))[2])::uuid)
);

DROP POLICY IF EXISTS "Workspace members can upload workspace avatar" ON storage.objects;
CREATE POLICY "Workspace members can upload workspace avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'workspaces'
  AND (storage.foldername(name))[2] IS NOT NULL
  AND public.user_is_workspace_member(((storage.foldername(name))[2])::uuid)
);

DROP POLICY IF EXISTS "Workspace members can update workspace avatar" ON storage.objects;
CREATE POLICY "Workspace members can update workspace avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'workspaces'
  AND (storage.foldername(name))[2] IS NOT NULL
  AND public.user_is_workspace_member(((storage.foldername(name))[2])::uuid)
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'workspaces'
  AND (storage.foldername(name))[2] IS NOT NULL
  AND public.user_is_workspace_member(((storage.foldername(name))[2])::uuid)
);

DROP POLICY IF EXISTS "Workspace members can remove workspace avatar" ON storage.objects;
CREATE POLICY "Workspace members can remove workspace avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'workspaces'
  AND (storage.foldername(name))[2] IS NOT NULL
  AND public.user_is_workspace_member(((storage.foldername(name))[2])::uuid)
);