-- Faculdade compartilhada entre membros do workspace: owner_id identifica o aluno
-- (perfil acadêmico), não confidencialidade. Qualquer membro lê/edita os dois perfis;
-- inserções exigem created_by = auth.uid() e owner_id de membro real do mesmo espaço
-- (garantido pela FK composta abaixo). Dados e backfill da 0017 são preservados,
-- assim como as FKs compostas avaliação/aula→disciplina e o trigger disciplina→período.

-- owner_id precisa ser membro real do mesmo workspace.
ALTER TABLE public.academic_terms
  ADD CONSTRAINT academic_terms_owner_member_fkey
  FOREIGN KEY (workspace_id, owner_id)
  REFERENCES public.workspace_members (workspace_id, user_id);
ALTER TABLE public.academic_courses
  ADD CONSTRAINT academic_courses_owner_member_fkey
  FOREIGN KEY (workspace_id, owner_id)
  REFERENCES public.workspace_members (workspace_id, user_id);
ALTER TABLE public.academic_evaluations
  ADD CONSTRAINT academic_evaluations_owner_member_fkey
  FOREIGN KEY (workspace_id, owner_id)
  REFERENCES public.workspace_members (workspace_id, user_id);
ALTER TABLE public.academic_sessions
  ADD CONSTRAINT academic_sessions_owner_member_fkey
  FOREIGN KEY (workspace_id, owner_id)
  REFERENCES public.workspace_members (workspace_id, user_id);

-- Políticas por membro do workspace (sem owner_id = auth.uid()).
DROP POLICY academic_terms_select ON public.academic_terms;
DROP POLICY academic_terms_insert ON public.academic_terms;
DROP POLICY academic_terms_update ON public.academic_terms;
DROP POLICY academic_terms_delete ON public.academic_terms;
DROP POLICY academic_courses_select ON public.academic_courses;
DROP POLICY academic_courses_insert ON public.academic_courses;
DROP POLICY academic_courses_update ON public.academic_courses;
DROP POLICY academic_courses_delete ON public.academic_courses;
DROP POLICY academic_evaluations_select ON public.academic_evaluations;
DROP POLICY academic_evaluations_insert ON public.academic_evaluations;
DROP POLICY academic_evaluations_update ON public.academic_evaluations;
DROP POLICY academic_evaluations_delete ON public.academic_evaluations;
DROP POLICY academic_sessions_select ON public.academic_sessions;
DROP POLICY academic_sessions_insert ON public.academic_sessions;
DROP POLICY academic_sessions_update ON public.academic_sessions;
DROP POLICY academic_sessions_delete ON public.academic_sessions;

CREATE POLICY academic_terms_select ON public.academic_terms FOR SELECT TO authenticated
  USING (public.user_is_workspace_member(workspace_id));
CREATE POLICY academic_terms_insert ON public.academic_terms FOR INSERT TO authenticated
  WITH CHECK (public.user_is_workspace_member(workspace_id) AND created_by = auth.uid());
CREATE POLICY academic_terms_update ON public.academic_terms FOR UPDATE TO authenticated
  USING (public.user_is_workspace_member(workspace_id))
  WITH CHECK (public.user_is_workspace_member(workspace_id));
CREATE POLICY academic_terms_delete ON public.academic_terms FOR DELETE TO authenticated
  USING (public.user_is_workspace_member(workspace_id));

CREATE POLICY academic_courses_select ON public.academic_courses FOR SELECT TO authenticated
  USING (public.user_is_workspace_member(workspace_id));
CREATE POLICY academic_courses_insert ON public.academic_courses FOR INSERT TO authenticated
  WITH CHECK (public.user_is_workspace_member(workspace_id) AND created_by = auth.uid());
CREATE POLICY academic_courses_update ON public.academic_courses FOR UPDATE TO authenticated
  USING (public.user_is_workspace_member(workspace_id))
  WITH CHECK (public.user_is_workspace_member(workspace_id));
CREATE POLICY academic_courses_delete ON public.academic_courses FOR DELETE TO authenticated
  USING (public.user_is_workspace_member(workspace_id));

CREATE POLICY academic_evaluations_select ON public.academic_evaluations FOR SELECT TO authenticated
  USING (public.user_is_workspace_member(workspace_id));
CREATE POLICY academic_evaluations_insert ON public.academic_evaluations FOR INSERT TO authenticated
  WITH CHECK (public.user_is_workspace_member(workspace_id) AND created_by = auth.uid());
CREATE POLICY academic_evaluations_update ON public.academic_evaluations FOR UPDATE TO authenticated
  USING (public.user_is_workspace_member(workspace_id))
  WITH CHECK (public.user_is_workspace_member(workspace_id));
CREATE POLICY academic_evaluations_delete ON public.academic_evaluations FOR DELETE TO authenticated
  USING (public.user_is_workspace_member(workspace_id));

CREATE POLICY academic_sessions_select ON public.academic_sessions FOR SELECT TO authenticated
  USING (public.user_is_workspace_member(workspace_id));
CREATE POLICY academic_sessions_insert ON public.academic_sessions FOR INSERT TO authenticated
  WITH CHECK (public.user_is_workspace_member(workspace_id) AND created_by = auth.uid());
CREATE POLICY academic_sessions_update ON public.academic_sessions FOR UPDATE TO authenticated
  USING (public.user_is_workspace_member(workspace_id))
  WITH CHECK (public.user_is_workspace_member(workspace_id));
CREATE POLICY academic_sessions_delete ON public.academic_sessions FOR DELETE TO authenticated
  USING (public.user_is_workspace_member(workspace_id));