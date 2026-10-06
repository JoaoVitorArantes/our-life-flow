CREATE OR REPLACE FUNCTION public.audit_member_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nm text; ws uuid := coalesce(NEW.workspace_id, OLD.workspace_id);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE id = ws) THEN RETURN coalesce(NEW, OLD); END IF;
  SELECT name INTO nm FROM public.profiles WHERE id = coalesce(NEW.user_id, OLD.user_id);
  IF TG_OP = 'INSERT' THEN PERFORM public.log_activity(ws, 'member_added', 'member', nm);
  ELSIF TG_OP = 'DELETE' THEN PERFORM public.log_activity(ws, 'member_removed', 'member', nm);
  ELSIF NEW.role IS DISTINCT FROM OLD.role THEN PERFORM public.log_activity(ws, 'role_changed', 'member', nm);
  END IF;
  RETURN coalesce(NEW, OLD);
END $$;