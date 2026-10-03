CREATE TABLE public.routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  kind text NOT NULL DEFAULT 'ROUTINE' CHECK (kind IN ('ROUTINE','HABIT')),
  title text NOT NULL,
  description text,
  frequency text NOT NULL DEFAULT 'DAILY' CHECK (frequency IN ('DAILY','WEEKDAYS','WEEKLY','BIWEEKLY','MONTHLY','MONTH_DAYS','CUSTOM')),
  weekdays smallint[] NOT NULL DEFAULT '{}',
  month_days smallint[] NOT NULL DEFAULT '{}',
  interval_days integer,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  start_time time,
  duration_minutes integer,
  person_scope text NOT NULL DEFAULT 'COUPLE',
  context_id uuid REFERENCES public.contexts(id) ON DELETE SET NULL,
  goal_id uuid REFERENCES public.goals(id) ON DELETE SET NULL,
  recurring_id uuid REFERENCES public.recurring_transactions(id) ON DELETE SET NULL,
  activity_type text,
  daily_target integer,
  weekly_target integer,
  color text,
  icon text,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','PAUSED','ARCHIVED')),
  show_in_agenda boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.routines TO authenticated;
GRANT ALL ON public.routines TO service_role;
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;
CREATE POLICY routines_select ON public.routines FOR SELECT TO authenticated USING (public.user_is_workspace_member(workspace_id));
CREATE POLICY routines_insert ON public.routines FOR INSERT TO authenticated WITH CHECK (public.user_is_workspace_member(workspace_id) AND created_by = auth.uid());
CREATE POLICY routines_update ON public.routines FOR UPDATE TO authenticated USING (public.user_is_workspace_member(workspace_id)) WITH CHECK (public.user_is_workspace_member(workspace_id));
CREATE POLICY routines_delete ON public.routines FOR DELETE TO authenticated USING (public.user_is_workspace_member(workspace_id));
CREATE TRIGGER routines_updated_at BEFORE UPDATE ON public.routines FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER routines_no_move BEFORE UPDATE ON public.routines FOR EACH ROW EXECUTE FUNCTION public.prevent_workspace_move();
CREATE INDEX routines_workspace_idx ON public.routines(workspace_id);

CREATE TABLE public.routine_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  routine_id uuid NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  status text NOT NULL DEFAULT 'DONE' CHECK (status IN ('DONE','SKIPPED')),
  count integer NOT NULL DEFAULT 1,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (routine_id, log_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.routine_logs TO authenticated;
GRANT ALL ON public.routine_logs TO service_role;
ALTER TABLE public.routine_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY routine_logs_select ON public.routine_logs FOR SELECT TO authenticated USING (public.user_is_workspace_member(workspace_id));
CREATE POLICY routine_logs_insert ON public.routine_logs FOR INSERT TO authenticated WITH CHECK (
  public.user_is_workspace_member(workspace_id) AND user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.routines r WHERE r.id = routine_id AND r.workspace_id = routine_logs.workspace_id));
CREATE POLICY routine_logs_update ON public.routine_logs FOR UPDATE TO authenticated USING (public.user_is_workspace_member(workspace_id)) WITH CHECK (public.user_is_workspace_member(workspace_id));
CREATE POLICY routine_logs_delete ON public.routine_logs FOR DELETE TO authenticated USING (public.user_is_workspace_member(workspace_id));
CREATE TRIGGER routine_logs_no_move BEFORE UPDATE ON public.routine_logs FOR EACH ROW EXECUTE FUNCTION public.prevent_workspace_move();
CREATE INDEX routine_logs_ws_date_idx ON public.routine_logs(workspace_id, log_date);