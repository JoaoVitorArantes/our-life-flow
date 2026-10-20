import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type AcademicTerm = Tables<"academic_terms">;
export type AcademicCourse = Tables<"academic_courses">;
export type AcademicEvaluation = Tables<"academic_evaluations">;
export type AcademicSession = Tables<"academic_sessions">;

export function useAcademicTerms(workspaceId?: string) {
  return useQuery({
    queryKey: ["academic_terms", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from("academic_terms")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("starts_on", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as AcademicTerm[];
    },
  });
}

export function useAcademicCourses(workspaceId?: string) {
  return useQuery({
    queryKey: ["academic_courses", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from("academic_courses")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("semester", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true });
      if (error) throw error;
      return data as AcademicCourse[];
    },
  });
}

export function useAcademicEvaluations(workspaceId?: string) {
  return useQuery({
    queryKey: ["academic_evaluations", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from("academic_evaluations")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as AcademicEvaluation[];
    },
  });
}

export function useAcademicSessions(workspaceId?: string) {
  return useQuery({
    queryKey: ["academic_sessions", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from("academic_sessions")
        .select("*")
        .eq("workspace_id", workspaceId)
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
