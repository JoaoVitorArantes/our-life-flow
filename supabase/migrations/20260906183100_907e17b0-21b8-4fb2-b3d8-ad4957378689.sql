CREATE TABLE public.physical_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  activity_type text NOT NULL DEFAULT 'OTHER',
  title text NOT NULL,
  description text,
  activity_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  start_time time,
  duration_minutes integer,
  distance_km numeric,
  location text,
  person_scope text NOT NULL DEFAULT 'COUPLE',
  context_id uuid REFERENCES public.contexts(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.physical_activities TO authenticated;
GRANT ALL ON public.physical_activities TO service_role;

ALTER TABLE public.physical_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view workspace activities"
ON public.physical_activities FOR SELECT TO authenticated
USING (public.user_is_workspace_member(workspace_id));

CREATE POLICY "Members can create workspace activities"
ON public.physical_activities FOR INSERT TO authenticated
WITH CHECK (public.user_is_workspace_member(workspace_id) AND created_by = auth.uid());

CREATE POLICY "Members can update workspace activities"
ON public.physical_activities FOR UPDATE TO authenticated
USING (public.user_is_workspace_member(workspace_id))
WITH CHECK (public.user_is_workspace_member(workspace_id));

CREATE POLICY "Members can delete workspace activities"
ON public.physical_activities FOR DELETE TO authenticated
USING (public.user_is_workspace_member(workspace_id));

CREATE INDEX physical_activities_workspace_date_idx
ON public.physical_activities (workspace_id, activity_date DESC);

CREATE TRIGGER physical_activities_set_updated_at
BEFORE UPDATE ON public.physical_activities
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();