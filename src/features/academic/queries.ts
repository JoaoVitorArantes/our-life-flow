import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type AcademicProfile = Tables<"academic_profiles">;
export type AcademicTerm = Tables<"academic_terms">;
export type AcademicCourse = Tables<"academic_courses">;
export type AcademicEvaluation = Tables<"academic_evaluations">;
export type AcademicSession = Tables<"academic_sessions">;

/**
 * Consultas acadêmicas: sempre escopadas pelo aluno selecionado (owner_id = ownerId).
 * A Faculdade é compartilhada entre membros do workspace; o filtro explícito mantém
 * os perfis separados e a cache do React Query isolada por aluno. O RLS é a última barreira.
 */

/** Perfil acadêmico do aluno (instituição/curso/currículo/ingresso); null quando ainda não configurado. */
export function useAcademicProfile(workspaceId?: string, ownerId?: string) {
  return useQuery({
    queryKey: ["academic_profiles", workspaceId, ownerId],
    enabled: !!workspaceId && !!ownerId,
    queryFn: async () => {
      if (!workspaceId || !ownerId) return null;
      const { data, error } = await supabase
        .from("academic_profiles")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("owner_id", ownerId)
        .maybeSingle();
      if (error) throw error;
      return data as AcademicProfile | null;
    },
  });
}

export function useAcademicTerms(workspaceId?: string, ownerId?: string) {
  return useQuery({
    queryKey: ["academic_terms", workspaceId, ownerId],
    enabled: !!workspaceId && !!ownerId,
    queryFn: async () => {
      if (!workspaceId || !ownerId) return [];
      const { data, error } = await supabase
        .from("academic_terms")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("owner_id", ownerId)
        .order("starts_on", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as AcademicTerm[];
    },
  });
}

export function useAcademicCourses(workspaceId?: string, ownerId?: string) {
  return useQuery({
    queryKey: ["academic_courses", workspaceId, ownerId],
    enabled: !!workspaceId && !!ownerId,
    queryFn: async () => {
      if (!workspaceId || !ownerId) return [];
      const { data, error } = await supabase
        .from("academic_courses")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("owner_id", ownerId)
        .order("semester", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true });
      if (error) throw error;
      return data as AcademicCourse[];
    },
  });
}

export function useAcademicEvaluations(workspaceId?: string, ownerId?: string) {
  return useQuery({
    queryKey: ["academic_evaluations", workspaceId, ownerId],
    enabled: !!workspaceId && !!ownerId,
    queryFn: async () => {
      if (!workspaceId || !ownerId) return [];
      const { data, error } = await supabase
        .from("academic_evaluations")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("owner_id", ownerId)
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as AcademicEvaluation[];
    },
  });
}

export function useAcademicSessions(workspaceId?: string, ownerId?: string) {
  return useQuery({
    queryKey: ["academic_sessions", workspaceId, ownerId],
    enabled: !!workspaceId && !!ownerId,
    queryFn: async () => {
      if (!workspaceId || !ownerId) return [];
      const { data, error } = await supabase
        .from("academic_sessions")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("owner_id", ownerId)
        .order("starts_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data as AcademicSession[];
    },
  });
}

/** Frequência calculada a partir das aulas registradas; null quando não há dados suficientes. */
export function attendanceFromSessions(
  sessions: readonly AcademicSession[],
  courseId: string,
): { attended: number; total: number; percent: number | null } {
  const ofCourse = sessions.filter((s) => s.course_id === courseId);
  const marked = ofCourse.filter((s) => s.attended !== null);
  const attended = marked.filter((s) => s.attended === true).length;
  return {
    attended,
    total: marked.length,
    percent: marked.length ? Math.round((attended / marked.length) * 100) : null,
  };
}
