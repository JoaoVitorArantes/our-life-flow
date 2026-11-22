CREATE OR REPLACE FUNCTION public.wedding_portal_cover_path(_cred text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _inv uuid := public.wedding_portal_resolve(_cred);
BEGIN
  IF _inv IS NULL THEN RETURN NULL; END IF;
  RETURN (SELECT p.cover_path FROM public.wedding_invitations i
    JOIN public.wedding_plans p ON p.workspace_id = i.workspace_id
    WHERE i.id = _inv AND p.cover_path LIKE i.workspace_id::text || '/%');
END $$;
REVOKE ALL ON FUNCTION public.wedding_portal_cover_path(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wedding_portal_cover_path(text) TO service_role;