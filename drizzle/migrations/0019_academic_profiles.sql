CREATE TABLE public.academic_profiles (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  institution text,
  course_name text,
  curriculum text,
  admission_year integer,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, owner_id),
  CONSTRAINT academic_profiles_owner_member_fkey
    FOREIGN KEY (workspace_id, owner_id)
    REFERENCES public.workspace_members (workspace_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_profiles TO authenticated;
GRANT ALL ON public.academic_profiles TO service_role;

ALTER TABLE public.academic_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY academic_profiles_select ON public.academic_profiles
  FOR SELECT USING (public.user_is_workspace_member(workspace_id));

CREATE POLICY academic_profiles_insert ON public.academic_profiles
  FOR INSERT WITH CHECK (public.user_is_workspace_member(workspace_id) AND created_by = auth.uid());

CREATE POLICY academic_profiles_update ON public.academic_profiles
  FOR UPDATE USING (public.user_is_workspace_member(workspace_id));

CREATE POLICY academic_profiles_delete ON public.academic_profiles
  FOR DELETE USING (public.user_is_workspace_member(workspace_id));

CREATE TRIGGER academic_profiles_updated_at
  BEFORE UPDATE ON public.academic_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();