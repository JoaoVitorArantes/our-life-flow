CREATE POLICY "Workspace members can view profile avatars"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    owner_id = auth.uid()::text
    OR EXISTS (
      SELECT 1
      FROM public.workspace_members viewer
      JOIN public.workspace_members subject
        ON subject.workspace_id = viewer.workspace_id
      WHERE viewer.user_id = auth.uid()
        AND subject.user_id::text = storage.objects.owner_id
    )
  )
);

CREATE POLICY "Users can upload their own profile avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND owner_id = auth.uid()::text
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own profile avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND owner_id = auth.uid()::text
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND owner_id = auth.uid()::text
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can remove their own profile avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND owner_id = auth.uid()::text
  AND (storage.foldername(name))[1] = auth.uid()::text
);