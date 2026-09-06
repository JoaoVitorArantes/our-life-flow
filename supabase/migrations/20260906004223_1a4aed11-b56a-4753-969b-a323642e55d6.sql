DO $$
DECLARE
  canonical_workspace uuid := '2c3cecfb-b766-443e-987e-954fe96c5cdb';
  secondary_workspace uuid := 'ec60f770-4b18-4678-af16-f81af590f106';
  secondary_user uuid := 'ee2cbb3f-6f0c-4227-bd96-4db56cc8ed0d';
  table_name text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE id = canonical_workspace) THEN
    RAISE EXCEPTION 'Canonical workspace not found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE id = secondary_workspace) THEN
    RAISE EXCEPTION 'Secondary workspace not found';
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (canonical_workspace, secondary_user, 'MEMBER')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  FOREACH table_name IN ARRAY ARRAY[
    'accounts', 'cards', 'categories', 'contexts', 'events', 'financings',
    'goals', 'installment_plans', 'loans', 'notes', 'recurring_transactions',
    'settlements', 'tasks', 'transactions'
  ]
  LOOP
    EXECUTE format(
      'UPDATE public.%I SET workspace_id = $1 WHERE workspace_id = $2',
      table_name
    ) USING canonical_workspace, secondary_workspace;
  END LOOP;
END $$;