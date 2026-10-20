import { supabase } from "@/integrations/supabase/client";
import type { z } from "zod";
import {
  academicProfileInputSchema,
  courseInputSchema,
  evaluationInputSchema,
  sessionInputSchema,
  termInputSchema,
} from "./contracts";
import type {
  AcademicCourse,
  AcademicEvaluation,
  AcademicProfile,
  AcademicSession,
  AcademicTerm,
} from "./queries";

/**
 * Mutações acadêmicas: validam a entrada, gravam com o cliente do usuário (RLS)
 * e confirmam a gravação com uma leitura sob RLS antes de reportar sucesso.
 *
 * A Faculdade é compartilhada entre membros do workspace: `ownerId` é o aluno
 * (perfil acadêmico) selecionado e `userId` é a pessoa autenticada que registra
 * (created_by). Atualizações e exclusões filtram workspace + aluno explicitamente;
 * o RLS por workspace é a última barreira.
 */

async function insertAndVerify<T extends { id: string }>(
  insert: () => PromiseLike<{ data: { id: string } | null; error: unknown }>,
  readBack: (id: string) => PromiseLike<{ data: T | null; error: unknown }>,
  label: string,
): Promise<T> {
  const { data, error } = await insert();
  if (error || !data) throw new Error(`Não foi possível registrar ${label}.`);
  const { data: saved, error: readError } = await readBack(data.id);
  if (readError || !saved) throw new Error(`Não foi possível confirmar o registro de ${label}.`);
  return saved;
}

export async function createTerm(
  workspaceId: string,
  ownerId: string,
  userId: string,
  input: z.infer<typeof termInputSchema>,
): Promise<AcademicTerm> {
  const valid = termInputSchema.parse(input);
  return insertAndVerify(
    () =>
      supabase
        .from("academic_terms")
        .insert({ ...valid, workspace_id: workspaceId, owner_id: ownerId, created_by: userId })
        .select("id")
        .single(),
    (id) =>
      supabase
        .from("academic_terms")
        .select("*")
        .eq("id", id)
        .eq("workspace_id", workspaceId)
        .eq("owner_id", ownerId)
        .single(),
    "o período",
  );
}

export async function createCourse(
  workspaceId: string,
  ownerId: string,
  userId: string,
  input: z.infer<typeof courseInputSchema>,
  source: "USER" | "IMPORT" = "USER",
): Promise<AcademicCourse> {
  const valid = courseInputSchema.parse(input);
  return insertAndVerify(
    () =>
      supabase
        .from("academic_courses")
        .insert({
          ...valid,
          workspace_id: workspaceId,
          owner_id: ownerId,
          created_by: userId,
          source,
        })
        .select("id")
        .single(),
    (id) =>
      supabase
        .from("academic_courses")
        .select("*")
        .eq("id", id)
        .eq("workspace_id", workspaceId)
        .eq("owner_id", ownerId)
        .single(),
    "a disciplina",
  );
}

export async function updateCourse(
  workspaceId: string,
  ownerId: string,
  courseId: string,
  input: z.infer<typeof courseInputSchema>,
): Promise<AcademicCourse> {
  const valid = courseInputSchema.parse(input);
  return insertAndVerify(
    () =>
      supabase
        .from("academic_courses")
        .update({ ...valid, updated_at: new Date().toISOString() })
        .eq("id", courseId)
        .eq("workspace_id", workspaceId)
        .eq("owner_id", ownerId)
        .select("id")
        .single(),
    (id) =>
      supabase
        .from("academic_courses")
        .select("*")
        .eq("id", id)
        .eq("workspace_id", workspaceId)
        .eq("owner_id", ownerId)
        .single(),
    "a disciplina",
  );
}

export async function deleteCourse(
  workspaceId: string,
  ownerId: string,
  courseId: string,
): Promise<void> {
  const { error } = await supabase
    .from("academic_courses")
    .delete()
    .eq("id", courseId)
    .eq("workspace_id", workspaceId)
    .eq("owner_id", ownerId);
  if (error) throw new Error("Não foi possível remover a disciplina.");
}

export async function createEvaluation(
  workspaceId: string,
  ownerId: string,
  userId: string,
  input: z.infer<typeof evaluationInputSchema>,
  source: "USER" | "IMPORT" = "USER",
): Promise<AcademicEvaluation> {
  const valid = evaluationInputSchema.parse(input);
  return insertAndVerify(
    () =>
      supabase
        .from("academic_evaluations")
        .insert({
          ...valid,
          workspace_id: workspaceId,
          owner_id: ownerId,
          created_by: userId,
          source,
        })
        .select("id")
        .single(),
    (id) =>
      supabase
        .from("academic_evaluations")
        .select("*")
        .eq("id", id)
        .eq("workspace_id", workspaceId)
        .eq("owner_id", ownerId)
        .single(),
    "a avaliação",
  );
}

export async function updateEvaluation(
  workspaceId: string,
  ownerId: string,
  evaluationId: string,
  input: z.infer<typeof evaluationInputSchema>,
): Promise<AcademicEvaluation> {
  const valid = evaluationInputSchema.parse(input);
  return insertAndVerify(
    () =>
      supabase
        .from("academic_evaluations")
        .update({ ...valid, updated_at: new Date().toISOString() })
        .eq("id", evaluationId)
        .eq("workspace_id", workspaceId)
        .eq("owner_id", ownerId)
        .select("id")
        .single(),
    (id) =>
      supabase
        .from("academic_evaluations")
        .select("*")
        .eq("id", id)
        .eq("workspace_id", workspaceId)
        .eq("owner_id", ownerId)
        .single(),
    "a avaliação",
  );
}

export async function createSession(
  workspaceId: string,
  ownerId: string,
  userId: string,
  input: z.infer<typeof sessionInputSchema>,
  source: "USER" | "IMPORT" = "USER",
): Promise<AcademicSession> {
  const valid = sessionInputSchema.parse(input);
  const startsAt = valid.time
    ? new Date(`${valid.date}T${valid.time}:00`).toISOString()
    : new Date(`${valid.date}T12:00:00`).toISOString();
  return insertAndVerify(
    () =>
      supabase
        .from("academic_sessions")
        .insert({
          course_id: valid.course_id,
          starts_at: startsAt,
          duration_minutes: valid.duration_minutes,
          topic: valid.topic,
          attended: valid.attended,
          workspace_id: workspaceId,
          owner_id: ownerId,
          created_by: userId,
          source,
        })
        .select("id")
        .single(),
    (id) =>
      supabase
        .from("academic_sessions")
        .select("*")
        .eq("id", id)
        .eq("workspace_id", workspaceId)
        .eq("owner_id", ownerId)
        .single(),
    "a aula",
  );
}

export async function markAttendance(
  workspaceId: string,
  ownerId: string,
  sessionId: string,
  attended: boolean,
): Promise<void> {
  const { data, error } = await supabase
    .from("academic_sessions")
    .update({ attended, updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("workspace_id", workspaceId)
    .eq("owner_id", ownerId)
    .select("id")
    .single();
  if (error || !data) throw new Error("Não foi possível registrar a presença.");
}

/** Registra as pendências conhecidas informadas pelo usuário, sem duplicar nomes existentes. */
export async function seedKnownPendingCourses(
  workspaceId: string,
  ownerId: string,
  userId: string,
  names: readonly { name: string; notes: string }[],
  existingNames: readonly string[],
): Promise<number> {
  const existing = new Set(existingNames.map((n) => n.trim().toLocaleLowerCase()));
  let created = 0;
  for (const pending of names) {
    if (existing.has(pending.name.trim().toLocaleLowerCase())) continue;
    await createCourse(
      workspaceId,
      ownerId,
      userId,
      {
        name: pending.name,
        code: null,
        term_id: null,
        semester: null,
        credits: null,
        status: "PENDING",
        grade: null,
        attendance_percent: null,
        prerequisites: [],
        notes: pending.notes,
      },
      "USER",
    );
    created += 1;
  }
  return created;
}
