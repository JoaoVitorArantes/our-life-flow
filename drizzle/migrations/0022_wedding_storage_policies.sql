CREATE POLICY wedding_objects_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'wedding' AND public.user_is_workspace_member(((storage.foldername(name))[1])::uuid));
CREATE POLICY wedding_objects_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'wedding' AND public.user_is_workspace_member(((storage.foldername(name))[1])::uuid));
CREATE POLICY wedding_objects_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'wedding' AND public.user_is_workspace_member(((storage.foldername(name))[1])::uuid));
CREATE POLICY wedding_objects_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'wedding' AND public.user_is_workspace_member(((storage.foldername(name))[1])::uuid));