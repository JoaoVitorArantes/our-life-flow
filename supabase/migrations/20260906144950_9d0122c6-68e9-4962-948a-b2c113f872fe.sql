DO $$
DECLARE
  _dup uuid := 'ec60f770-4b18-4678-af16-f81af590f106';
  _keep uuid := '2c3cecfb-b766-443e-987e-954fe96c5cdb';
  _renifer uuid := 'ee2cbb3f-6f0c-4227-bd96-4db56cc8ed0d';
  _n bigint;
BEGIN
  SELECT count(*) INTO _n FROM (
    SELECT 1 FROM public.transactions WHERE workspace_id = _dup
    UNION ALL SELECT 1 FROM public.accounts WHERE workspace_id = _dup
    UNION ALL SELECT 1 FROM public.cards WHERE workspace_id = _dup
    UNION ALL SELECT 1 FROM public.events WHERE workspace_id = _dup
    UNION ALL SELECT 1 FROM public.tasks WHERE workspace_id = _dup
    UNION ALL SELECT 1 FROM public.goals WHERE workspace_id = _dup
    UNION ALL SELECT 1 FROM public.notes WHERE workspace_id = _dup
    UNION ALL SELECT 1 FROM public.contexts WHERE workspace_id = _dup
    UNION ALL SELECT 1 FROM public.loans WHERE workspace_id = _dup
    UNION ALL SELECT 1 FROM public.financings WHERE workspace_id = _dup
    UNION ALL SELECT 1 FROM public.installment_plans WHERE workspace_id = _dup
    UNION ALL SELECT 1 FROM public.recurring_transactions WHERE workspace_id = _dup
    UNION ALL SELECT 1 FROM public.goal_contributions WHERE workspace_id = _dup
    UNION ALL SELECT 1 FROM public.settlements WHERE workspace_id = _dup
    UNION ALL SELECT 1 FROM public.workspace_relationships WHERE workspace_id = _dup
    UNION ALL SELECT 1 FROM public.workspace_invitations WHERE workspace_id = _dup
  ) s;
  IF _n > 0 THEN
    RAISE EXCEPTION 'Workspace duplicado possui % registros; abortando.', _n;
  END IF;

  UPDATE public.profiles SET active_workspace_id = _keep WHERE id = _renifer;
  UPDATE public.profiles SET active_workspace_id = NULL WHERE active_workspace_id = _dup;
  DELETE FROM public.workspace_members WHERE workspace_id = _dup;
  DELETE FROM public.categories WHERE workspace_id = _dup;
  DELETE FROM public.workspaces WHERE id = _dup;
END $$;