import { z } from "zod";

/** Contratos do módulo acadêmico. Tudo é informação registrada pelo usuário — nada é oficial. */

export const COURSE_STATUSES = [
  { value: "PENDING", label: "Pendente" },
  { value: "ENROLLED", label: "Cursando" },
  { value: "COMPLETED", label: "Concluída" },
  { value: "FAILED", label: "Reprovada" },
  { value: "WAIVED", label: "Dispensada" },
] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number]["value"];

export const EVALUATION_KINDS = [
  { value: "EXAM", label: "Prova" },
  { value: "ASSIGNMENT", label: "Trabalho" },
  { value: "PROJECT", label: "Projeto" },
  { value: "QUIZ", label: "Questionário" },
  { value: "OTHER", label: "Outro" },
] as const;
export type EvaluationKind = (typeof EVALUATION_KINDS)[number]["value"];

export const TERM_STATUSES = [
  { value: "PLANNED", label: "Planejado" },
  { value: "ACTIVE", label: "Em andamento" },
  { value: "FINISHED", label: "Encerrado" },
] as const;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(`${s}T12:00:00Z`);
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "Data inválida");

export const termInputSchema = z
  .object({
    name: z.string().trim().min(1, "Informe o nome do período.").max(80),
    starts_on: isoDate.nullable(),
    ends_on: isoDate.nullable(),
    enrollment_until: isoDate.nullable(),
    status: z.enum(["PLANNED", "ACTIVE", "FINISHED"]),
  })
  .strict()
  .refine(
    (t) => !t.starts_on || !t.ends_on || t.starts_on <= t.ends_on,
    "O início deve ser anterior ao fim.",
  );

export const courseInputSchema = z
  .object({
    name: z.string().trim().min(1, "Informe o nome da disciplina.").max(120),
    code: z.string().trim().max(20).nullable(),
    term_id: z.string().uuid().nullable(),
    semester: z.number().int().min(1).max(20).nullable(),
    credits: z.number().int().min(0).max(60).nullable(),
    status: z.enum(["PENDING", "ENROLLED", "COMPLETED", "FAILED", "WAIVED"]),
    grade: z.number().min(0).max(100).nullable(),
    attendance_percent: z.number().min(0).max(100).nullable(),
    prerequisites: z.array(z.string().trim().min(1).max(120)).max(20),
    notes: z.string().trim().max(500).nullable(),
  })
  .strict();

export const evaluationInputSchema = z
  .object({
    course_id: z.string().uuid(),
    title: z.string().trim().min(1, "Informe o título da avaliação.").max(120),
    kind: z.enum(["EXAM", "ASSIGNMENT", "PROJECT", "QUIZ", "OTHER"]),
    due_date: isoDate.nullable(),
    weight: z.number().min(0).max(100).nullable(),
    grade: z.number().min(0).max(100).nullable(),
    status: z.enum(["PENDING", "DONE", "GRADED"]),
  })
  .strict();

export const sessionInputSchema = z
  .object({
    course_id: z.string().uuid(),
    date: isoDate,
    time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .nullable(),
    duration_minutes: z.number().int().min(1).max(1440).nullable(),
    topic: z.string().trim().max(200).nullable(),
    attended: z.boolean().nullable(),
  })
  .strict();

export function courseStatusLabel(status: string) {
  return COURSE_STATUSES.find((s) => s.value === status)?.label ?? status;
}
export function evaluationKindLabel(kind: string) {
  return EVALUATION_KINDS.find((k) => k.value === kind)?.label ?? kind;
}

/**
 * Perfil acadêmico de um aluno: instituição, curso, currículo e ano de ingresso.
 * Todos os campos são opcionais — o desconhecido fica explicitamente não informado.
 * Nada aqui é preenchido automaticamente: cada perfil declara seus próprios dados.
 */
export const academicProfileInputSchema = z
  .object({
    institution: z.string().trim().max(120).nullable(),
    course_name: z.string().trim().max(120).nullable(),
    curriculum: z.string().trim().max(80).nullable(),
    admission_year: z.number().int().min(1950).max(2100).nullable(),
  })
  .strict();

export const ACADEMIC_DISCLAIMER =
  "Informações declaradas pelos usuários. Grade, pré-requisitos, notas e calendário oficiais devem ser confirmados com a instituição.";

/**
 * Pendências declaradas pelo João para o perfil BSI/UFU dele. Semestre, nota,
 * requisitos e datas são desconhecidos — registrados como null. Este atalho só
 * é oferecido no perfil cujo cadastro declara Sistemas de Informação na UFU;
 * nunca é sugerido em outros perfis acadêmicos.
 */
export const KNOWN_PENDING_COURSES: readonly {
  name: string;
  notes: string;
}[] = [
  { name: "Algoritmos e Programação", notes: "Pendência informada pelo usuário." },
  {
    name: "Arquitetura e Organização de Computadores",
    notes: "Pendência informada pelo usuário.",
  },
  { name: "Cálculo I", notes: "Pendência informada pelo usuário." },
  { name: "Fundamentos de Marketing", notes: "Pendência informada pelo usuário." },
];
