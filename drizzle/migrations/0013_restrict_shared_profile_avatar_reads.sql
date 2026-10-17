ALTER POLICY "Workspace members can view profile avatars" ON storage.objects TO authenticated USING (
 bucket_id = 'avatars' AND (
  owner_id = auth.uid()::text
  OR (
   (storage.foldername(name))[1] = owner_id
   AND EXISTS (
    SELECT 1 FROM public.workspace_members viewer
    JOIN public.workspace_members subject ON subject.workspace_id = viewer.workspace_id
    WHERE viewer.user_id = auth.uid() AND subject.user_id::text = storage.objects.owner_id
   )
  )
 )
);
COMMENT ON POLICY "Workspace members can view profile avatars" ON storage.objects IS 'Sharing by uploader applies only to personal avatar folders; workspace image reads must use the workspace-folder membership policy.';