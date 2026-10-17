import { z } from "zod";

const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.").refine((v) => {
  const parsed = new Date(`${v}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === v;
}, "Informe uma data válida.").nullable().optional();
export const contextSchema = z.object({
  name: z.string().trim().min(1, "Informe um nome.").max(200),
  description: nullableText(5000),
  type: z.enum(["EVENT", "TRIP", "PROJECT", "COLLEGE", "PERSONAL", "COUPLE", "OTHER"]),
  status: z.enum(["PLANNED", "ACTIVE", "COMPLETED", "ARCHIVED"]),
  start_date: date, end_date: date, location: nullableText(500),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, "Escolha uma cor válida.").nullable().optional(),
  cover_image: z.string().max(2048).url("Informe uma URL de imagem válida.").refine((v) => /^https?:\/\//.test(v), "Use uma URL http ou https.").nullable().optional(),
  budget_amount: z.number().finite().nonnegative("O orçamento não pode ser negativo.").nullable().optional(),
  visibility: z.enum(["PRIVATE", "SHARED"]),
}).refine((v) => !v.start_date || !v.end_date || v.end_date >= v.start_date, { message: "A data final deve ser igual ou posterior ao início.", path: ["end_date"] });

export function contextSaveError(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Confira os campos do contexto.";
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (code === "42501") return "Você não tem permissão para salvar este contexto. Confira sua conta e o espaço selecionado.";
  if (code === "23503") return "O espaço selecionado não está disponível. Atualize a página e tente novamente.";
  if (code === "PGRST116") return "Este contexto não está disponível para edição na sua conta.";
  if (code.startsWith("22") || code.startsWith("23")) return "Confira as datas e o orçamento antes de salvar.";
  return "Não foi possível salvar o contexto agora. Tente novamente; se continuar, atualize a página.";
}