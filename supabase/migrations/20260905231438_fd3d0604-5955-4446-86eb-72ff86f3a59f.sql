CREATE TYPE public.context_type AS ENUM ('EVENT','TRIP','PROJECT','COLLEGE','PERSONAL','COUPLE','OTHER');
CREATE TYPE public.context_status AS ENUM ('PLANNED','ACTIVE','COMPLETED','ARCHIVED');

CREATE TABLE public.contexts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  type public.context_type NOT NULL DEFAULT 'PERSONAL',
  start_date date,
  end_date date,
  location text,
  cover_image text,
  color text,
  visibility public.visibility NOT NULL DEFAULT 'PRIVATE',
  status public.context_status NOT NULL DEFAULT 'ACTIVE',
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contexts TO authenticated;
GRANT ALL ON public.contexts TO service_role;
ALTER TABLE public.contexts ENABLE ROW LEVEL SECURITY;

CREATE POLICY contexts_select ON public.contexts FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id) AND (visibility = 'SHARED' OR owner_id = auth.uid()));
CREATE POLICY contexts_insert ON public.contexts FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND public.is_workspace_member(workspace_id));
CREATE POLICY contexts_update ON public.contexts FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY contexts_delete ON public.contexts FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE TRIGGER contexts_updated BEFORE UPDATE ON public.contexts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.transactions ADD COLUMN context_id uuid REFERENCES public.contexts(id) ON DELETE SET NULL;
ALTER TABLE public.events ADD COLUMN context_id uuid REFERENCES public.contexts(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN context_id uuid REFERENCES public.contexts(id) ON DELETE SET NULL;
ALTER TABLE public.notes ADD COLUMN context_id uuid REFERENCES public.contexts(id) ON DELETE SET NULL;
ALTER TABLE public.goals ADD COLUMN context_id uuid REFERENCES public.contexts(id) ON DELETE SET NULL;

CREATE INDEX idx_transactions_context ON public.transactions(context_id);
CREATE INDEX idx_events_context ON public.events(context_id);
CREATE INDEX idx_tasks_context ON public.tasks(context_id);
CREATE INDEX idx_notes_context ON public.notes(context_id);
CREATE INDEX idx_goals_context ON public.goals(context_id);

CREATE TABLE public.goal_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  contribution_date date NOT NULL DEFAULT current_date,
  description text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.goal_contributions TO authenticated;
GRANT ALL ON public.goal_contributions TO service_role;
ALTER TABLE public.goal_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY goal_contributions_select ON public.goal_contributions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id
    AND public.is_workspace_member(g.workspace_id)
    AND (g.visibility = 'SHARED' OR g.owner_id = auth.uid())));
CREATE POLICY goal_contributions_insert ON public.goal_contributions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id
    AND public.is_workspace_member(g.workspace_id)
    AND (g.visibility = 'SHARED' OR g.owner_id = auth.uid())));
CREATE POLICY goal_contributions_update ON public.goal_contributions FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY goal_contributions_delete ON public.goal_contributions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX idx_goal_contributions_goal ON public.goal_contributions(goal_id, contribution_date DESC);

CREATE TRIGGER goal_contributions_updated BEFORE UPDATE ON public.goal_contributions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();