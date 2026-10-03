-- Single atomic entry point: reset + full seed (core + purchases/activities/routines) in one transaction
CREATE OR REPLACE FUNCTION public.prepare_demo_workspace(_workspace_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.seed_demo_workspace(_workspace_id);  -- validates membership + is_demo, then resets
  PERFORM public.seed_demo_extras(_workspace_id);
END $$;
REVOKE ALL ON FUNCTION public.prepare_demo_workspace(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prepare_demo_workspace(uuid) TO authenticated;