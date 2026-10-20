CREATE TABLE public.academic_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  starts_on date,
  ends_on date,
  enrollment_until date,
  status text NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED','ACTIVE','FINISHED')),
  source text NOT NULL DEFAULT 'USER' CHECK (source IN ('USER','IMPORT')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_terms TO authenticated;
GRANT ALL ON public.academic_terms TO service_role;
ALTER TABLE public.academic_terms ENABLE ROW LEVEL SECURITY;
CREATE POLICY academic_terms_select ON public.academic_terms FOR SELECT TO authenticated USING (public.user_is_workspace_member(workspace_id));
CREATE POLICY academic_terms_insert ON public.academic_terms FOR INSERT TO authenticated WITH CHECK (public.user_is_workspace_member(workspace_id) AND created_by = auth.uid());
CREATE POLICY academic_terms_update ON public.academic_terms FOR UPDATE TO authenticated USING (public.user_is_workspace_member(workspace_id)) WITH CHECK (public.user_is_workspace_member(workspace_id));
CREATE POLICY academic_terms_delete ON public.academic_terms FOR DELETE TO authenticated USING (public.user_is_workspace_member(workspace_id));

CREATE TABLE public.academic_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  term_id uuid REFERENCES public.academic_terms(id) ON DELETE SET NULL,
  name text NOT NULL,
  code text,
  semester integer,
  credits integer,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ENROLLED','COMPLETED','FAILED','WAIVED')),
  grade numeric(5,2),
  attendance_percent numeric(5,2),
  prerequisites text[] NOT NULL DEFAULT '{}',
  notes text,
  source text NOT NULL DEFAULT 'USER' CHECK (source IN ('USER','IMPORT')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_courses TO authenticated;
GRANT ALL ON public.academic_courses TO service_role;
ALTER TABLE public.academic_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY academic_courses_select ON public.academic_courses FOR SELECT TO authenticated USING (public.user_is_workspace_member(workspace_id));
CREATE POLICY academic_courses_insert ON public.academic_courses FOR INSERT TO authenticated WITH CHECK (public.user_is_workspace_member(workspace_id) AND created_by = auth.uid());
CREATE POLICY academic_courses_update ON public.academic_courses FOR UPDATE TO authenticated USING (public.user_is_workspace_member(workspace_id)) WITH CHECK (public.user_is_workspace_member(workspace_id));
CREATE POLICY academic_courses_delete ON public.academic_courses FOR DELETE TO authenticated USING (public.user_is_workspace_member(workspace_id));

CREATE TABLE public.academic_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.academic_courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'EXAM' CHECK (kind IN ('EXAM','ASSIGNMENT','PROJECT','QUIZ','OTHER')),
  due_date date,
  weight numeric(5,2),
  grade numeric(5,2),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','DONE','GRADED')),
  source text NOT NULL DEFAULT 'USER' CHECK (source IN ('USER','IMPORT')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_evaluations TO authenticated;
GRANT ALL ON public.academic_evaluations TO service_role;
ALTER TABLE public.academic_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY academic_evaluations_select ON public.academic_evaluations FOR SELECT TO authenticated USING (public.user_is_workspace_member(workspace_id));
CREATE POLICY academic_evaluations_insert ON public.academic_evaluations FOR INSERT TO authenticated WITH CHECK (public.user_is_workspace_member(workspace_id) AND created_by = auth.uid());
CREATE POLICY academic_evaluations_update ON public.academic_evaluations FOR UPDATE TO authenticated USING (public.user_is_workspace_member(workspace_id)) WITH CHECK (public.user_is_workspace_member(workspace_id));
CREATE POLICY academic_evaluations_delete ON public.academic_evaluations FOR DELETE TO authenticated USING (public.user_is_workspace_member(workspace_id));

CREATE TABLE public.academic_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.academic_courses(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  duration_minutes integer,
  topic text,
  attended boolean,
  source text NOT NULL DEFAULT 'USER' CHECK (source IN ('USER','IMPORT')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_sessions TO authenticated;
GRANT ALL ON public.academic_sessions TO service_role;
ALTER TABLE public.academic_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY academic_sessions_select ON public.academic_sessions FOR SELECT TO authenticated USING (public.user_is_workspace_member(workspace_id));
CREATE POLICY academic_sessions_insert ON public.academic_sessions FOR INSERT TO authenticated WITH CHECK (public.user_is_workspace_member(workspace_id) AND created_by = auth.uid());
CREATE POLICY academic_sessions_update ON public.academic_sessions FOR UPDATE TO authenticated USING (public.user_is_workspace_member(workspace_id)) WITH CHECK (public.user_is_workspace_member(workspace_id));
CREATE POLICY academic_sessions_delete ON public.academic_sessions FOR DELETE TO authenticated USING (public.user_is_workspace_member(workspace_id));