CREATE TABLE public.ai_capability_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL,
 capability text NOT NULL CHECK (capability ~ '^[a-z_]{1,80}$'),
 tool text NOT NULL CHECK (tool ~ '^[a-z_]{1,80}$'),
 run_id uuid NOT NULL,
 outcome text NOT NULL CHECK (outcome IN ('success','failure')),
 confirmation text NOT NULL CHECK (confirmation IN ('not_required','proposed','accepted')),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_capability_runs TO authenticated;
GRANT ALL ON public.ai_capability_runs TO service_role;
ALTER TABLE public.ai_capability_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_workspace_capability_runs ON public.ai_capability_runs FOR SELECT TO authenticated USING (actor_id = auth.uid() AND public.is_workspace_member(workspace_id));
CREATE INDEX ai_capability_runs_workspace_actor_time ON public.ai_capability_runs(workspace_id,actor_id,created_at DESC);
COMMENT ON TABLE public.ai_capability_runs IS 'Server-written execution metadata only. No inputs, outputs, messages, credentials or error details. Confirmation accepted records authorization, not proof of a later client mutation.';