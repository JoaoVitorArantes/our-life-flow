CREATE TABLE public.ai_plugin_preferences (
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
 user_id uuid NOT NULL,
 plugin_id text NOT NULL CHECK (plugin_id IN ('finance','agenda','tasks','goals','contexts','purchases','routines','activities','notes','workspace')),
 enabled boolean NOT NULL DEFAULT true,
 configuration jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (configuration = '{}'::jsonb),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,user_id,plugin_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_plugin_preferences TO authenticated;
GRANT ALL ON public.ai_plugin_preferences TO service_role;
ALTER TABLE public.ai_plugin_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_plugin_preferences ON public.ai_plugin_preferences FOR ALL TO authenticated USING (user_id=auth.uid() AND public.is_workspace_member(workspace_id)) WITH CHECK (user_id=auth.uid() AND public.is_workspace_member(workspace_id));
CREATE TRIGGER plugin_preferences_updated BEFORE UPDATE ON public.ai_plugin_preferences FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER plugin_preferences_sync AFTER INSERT OR UPDATE OR DELETE ON public.ai_plugin_preferences FOR EACH ROW EXECUTE FUNCTION public.emit_workspace_sync_event();
CREATE OR REPLACE FUNCTION public.validate_context_input() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF length(trim(NEW.name)) NOT BETWEEN 1 AND 200 OR length(NEW.description)>5000 OR length(NEW.location)>500 OR length(NEW.cover_image)>2048 THEN RAISE EXCEPTION 'Invalid context fields' USING ERRCODE='22023'; END IF;
 IF NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL AND NEW.end_date<NEW.start_date THEN RAISE EXCEPTION 'Invalid date range' USING ERRCODE='22023'; END IF;
 IF NEW.budget_amount IS NOT NULL AND (NEW.budget_amount<0 OR NEW.budget_amount::text IN ('NaN','Infinity','-Infinity')) THEN RAISE EXCEPTION 'Invalid budget' USING ERRCODE='22023'; END IF;
 IF NEW.color IS NOT NULL AND NEW.color !~* '^#[0-9a-f]{6}$' THEN RAISE EXCEPTION 'Invalid color' USING ERRCODE='22023'; END IF;
 IF NEW.cover_image IS NOT NULL AND NEW.cover_image !~ '^https?://' THEN RAISE EXCEPTION 'Invalid cover URL' USING ERRCODE='22023'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_context_fields BEFORE INSERT OR UPDATE ON public.contexts FOR EACH ROW EXECUTE FUNCTION public.validate_context_input();