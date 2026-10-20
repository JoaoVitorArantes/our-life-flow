/** Intents acadêmicos — compartilhado entre cliente (execução confirmada) e servidor (validação). */
export const ACADEMIC_INTENTS = ["create_evaluation", "log_class"] as const;
export function isAcademicIntent(intent: string) {
  return (ACADEMIC_INTENTS as readonly string[]).includes(intent);
}
