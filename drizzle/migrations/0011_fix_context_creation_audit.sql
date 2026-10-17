CREATE OR REPLACE FUNCTION public.audit_created_record() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE record_label text;
BEGIN
  IF auth.uid() IS NULL OR NEW.is_demo THEN RETURN NEW; END IF;
  record_label := CASE WHEN TG_TABLE_NAME = 'contexts' THEN to_jsonb(NEW)->>'name' ELSE to_jsonb(NEW)->>'title' END;
  PERFORM public.log_activity(NEW.workspace_id, 'created', TG_TABLE_NAME, record_label);
  RETURN NEW;
END;
$$;