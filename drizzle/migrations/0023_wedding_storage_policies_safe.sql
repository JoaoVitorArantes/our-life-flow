CREATE OR REPLACE FUNCTION public.wedding_object_allowed(_bucket text, _name text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE folder text;
BEGIN
  IF _bucket <> 'wedding' THEN RETURN false; END IF;
  folder := split_part(_name, '/', 1);
  IF folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN false; END IF;
  RETURN public.user_is_workspace_member(folder::uuid);
END $$;
DROP POLICY wedding_objects_select ON storage.objects;
DROP POLICY wedding_objects_insert ON storage.objects;
DROP POLICY wedding_objects_update ON storage.objects;
DROP POLICY wedding_objects_delete ON storage.objects;
CREATE POLICY wedding_objects_select ON storage.objects FOR SELECT TO authenticated USING (public.wedding_object_allowed(bucket_id, name));
CREATE POLICY wedding_objects_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (public.wedding_object_allowed(bucket_id, name));
CREATE POLICY wedding_objects_update ON storage.objects FOR UPDATE TO authenticated USING (public.wedding_object_allowed(bucket_id, name));
CREATE POLICY wedding_objects_delete ON storage.objects FOR DELETE TO authenticated USING (public.wedding_object_allowed(bucket_id, name));