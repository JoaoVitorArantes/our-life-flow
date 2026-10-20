-- Faculdade privada por pessoa: cada registro acadêmico pertence a um único dono,
-- mesmo dentro de um workspace compartilhado. Backfill usa apenas created_by (metadado
-- de autoria já persistido); nenhum conteúdo de registro é lido ou exposto.

ALTER TABLE public.academic_terms ADD COLUMN owner_id uuid;
ALTER TABLE public.academic_courses ADD COLUMN owner_id uuid;
ALTER TABLE public.academic_evaluations ADD COLUMN owner_id uuid;
ALTER TABLE public.academic_sessions ADD COLUMN owner_id uuid;

UPDATE public.academic_terms SET owner_id = created_by;
UPDATE public.academic_courses SET owner_id = created_by;
UPDATE public.academic_evaluations SET owner_id = created_by;
UPDATE public.academic_sessions SET owner_id = created_by;

ALTER TABLE public.academic_terms ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE public.academic_courses ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE public.academic_evaluations ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE public.academic_sessions ALTER COLUMN owner_id SET NOT NULL;

-- Unicidade composta para FKs que amarram filho ao mesmo dono e workspace do pai.
ALTER TABLE public.academic_terms
  ADD CONSTRAINT academic_terms_id_workspace_owner_key UNIQUE (id, workspace_id, owner_id);
ALTER TABLE public.academic_courses
  ADD CONSTRAINT academic_courses_id_workspace_owner_key UNIQUE (id, workspace_id, owner_id);

-- Avaliações e aulas só podem referenciar disciplina do mesmo dono e workspace.
ALTER TABLE public.academic_evaluations
  ADD CONSTRAINT academic_evaluations_course_owner_fkey
  FOREIGN KEY (course_id, workspace_id, owner_id)
  REFERENCES public.academic_courses (id, workspace_id, owner_id) ON DELETE CASCADE;
ALTER TABLE public.academic_sessions
  ADD CONSTRAINT academic_sessions_course_owner_fkey
  FOREIGN KEY (course_id, workspace_id, owner_id)
  REFERENCES public.academic_courses (id, workspace_id, owner_id) ON DELETE CASCADE;

-- Disciplina só pode referenciar período do mesmo dono e workspace
-- (FK simples com SET NULL é preservada; o trigger valida o vínculo).
CREATE OR REPLACE FUNCTION public.validate_academic_term_owner()
RETURNS trigger
LANGUAGE plpgsql
AS $func$
BEGIN
  IF NEW.term_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.academic_terms t
    WHERE t.id = NEW.term_id
      AND t.workspace_id = NEW.workspace_id
      AND t.owner_id = NEW.owner_id
  ) THEN
    RAISE EXCEPTION 'O período precisa pertencer ao mesmo espaço e à mesma pessoa da disciplina.';
  END IF;
  RETURN NEW;
END;
$func$;

CREATE TRIGGER academic_courses_term_owner
  BEFORE INSERT OR UPDATE ON public.academic_courses
  FOR EACH ROW EXECUTE FUNCTION public.validate_academic_term_owner();

-- Políticas por dono: substituem as anteriores (somente por workspace).
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
  USING (public.user_is_workspace_member(workspace_id) AND owner_id = auth.uid());
CREATE POLICY academic_terms_insert ON public.academic_terms FOR INSERT TO authenticated
  WITH CHECK (public.user_is_workspace_member(workspace_id) AND owner_id = auth.uid() AND created_by = auth.uid());
CREATE POLICY academic_terms_update ON public.academic_terms FOR UPDATE TO authenticated
  USING (public.user_is_workspace_member(workspace_id) AND owner_id = auth.uid())
  WITH CHECK (public.user_is_workspace_member(workspace_id) AND owner_id = auth.uid());
CREATE POLICY academic_terms_delete ON public.academic_terms FOR DELETE TO authenticated
  USING (public.user_is_workspace_member(workspace_id) AND owner_id = auth.uid());

CREATE POLICY academic_courses_select ON public.academic_courses FOR SELECT TO authenticated
  USING (public.user_is_workspace_member(workspace_id) AND owner_id = auth.uid());
CREATE POLICY academic_courses_insert ON public.academic_courses FOR INSERT TO authenticated
  WITH CHECK (public.user_is_workspace_member(workspace_id) AND owner_id = auth.uid() AND created_by = auth.uid());
CREATE POLICY academic_courses_update ON public.academic_courses FOR UPDATE TO authenticated
  USING (public.user_is_workspace_member(workspace_id) AND owner_id = auth.uid())
  WITH CHECK (public.user_is_workspace_member(workspace_id) AND owner_id = auth.uid());
CREATE POLICY academic_courses_delete ON public.academic_courses FOR DELETE TO authenticated
  USING (public.user_is_workspace_member(workspace_id) AND owner_id = auth.uid());

CREATE POLICY academic_evaluations_select ON public.academic_evaluations FOR SELECT TO authenticated
  USING (public.user_is_workspace_member(workspace_id) AND owner_id = auth.uid());
CREATE POLICY academic_evaluations_insert ON public.academic_evaluations FOR INSERT TO authenticated
  WITH CHECK (public.user_is_workspace_member(workspace_id) AND owner_id = auth.uid() AND created_by = auth.uid());
CREATE POLICY academic_evaluations_update ON public.academic_evaluations FOR UPDATE TO authenticated
  USING (public.user_is_workspace_member(workspace_id) AND owner_id = auth.uid())
  WITH CHECK (public.user_is_workspace_member(workspace_id) AND owner_id = auth.uid());
CREATE POLICY academic_evaluations_delete ON public.academic_evaluations FOR DELETE TO authenticated
  USING (public.user_is_workspace_member(workspace_id) AND owner_id = auth.uid());

CREATE POLICY academic_sessions_select ON public.academic_sessions FOR SELECT TO authenticated
  USING (public.user_is_workspace_member(workspace_id) AND owner_id = auth.uid());
CREATE POLICY academic_sessions_insert ON public.academic_sessions FOR INSERT TO authenticated
  WITH CHECK (public.user_is_workspace_member(workspace_id) AND owner_id = auth.uid() AND created_by = auth.uid());
CREATE POLICY academic_sessions_update ON public.academic_sessions FOR UPDATE TO authenticated
  USING (public.user_is_workspace_member(workspace_id) AND owner_id = auth.uid())
  WITH CHECK (public.user_is_workspace_member(workspace_id) AND owner_id = auth.uid());
CREATE POLICY academic_sessions_delete ON public.academic_sessions FOR DELETE TO authenticated
  USING (public.user_is_workspace_member(workspace_id) AND owner_id = auth.uid());