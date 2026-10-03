import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Pipeline da Inbox (reutilizável por qualquer canal: web, PWA e, no futuro, WhatsApp):
 * mensagem → usuário autenticado → workspace do usuário → IA interpreta → backend valida e
 * resolve entidades reais → prévia. A execução acontece só após confirmação, usando as
 * mesmas mutações da interface (sujeitas às RLS).
 */
const inputSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(2000) }))
    .min(1)
    .max(16),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weekday: z.string().max(20),
});

export const interpretInbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Workspace SEMPRE vem do usuário autenticado, nunca da mensagem.
    const { data: profile } = await supabase.from("profiles").select("name, active_workspace_id").eq("id", userId).maybeSingle();
    let workspaceId = profile?.active_workspace_id ?? null;
    if (!workspaceId) {
      const { data: m } = await supabase.from("workspace_members").select("workspace_id").eq("user_id", userId).limit(1).maybeSingle();
      workspaceId = m?.workspace_id ?? null;
    }
    if (!workspaceId) throw new Error("Nenhum espaço encontrado para este usuário.");

    const [cards, accounts, categories, contexts, members] = await Promise.all([
      supabase.from("cards").select("id, name, institution, owner_id").eq("workspace_id", workspaceId).eq("is_active", true),
      supabase.from("accounts").select("id, name, institution, account_type, owner_id").eq("workspace_id", workspaceId).eq("is_active", true),
      supabase.from("categories").select("id, name, type").eq("workspace_id", workspaceId),
      supabase.from("contexts").select("id, name, type, status").eq("workspace_id", workspaceId).neq("status", "ARCHIVED"),
      supabase.from("workspace_members").select("user_id").eq("workspace_id", workspaceId),
    ]);
    const memberIds = (members.data ?? []).map((m) => m.user_id);
    const { data: profiles } = memberIds.length
      ? await supabase.from("profiles").select("id, name").in("id", memberIds)
      : { data: [] as { id: string; name: string }[] };
    const people = (profiles ?? []).map((p) => ({ id: p.id, name: p.name, me: p.id === userId }));

    const list = <T,>(rows: T[] | null | undefined) => JSON.stringify(rows ?? []);
    const system = `Você é o interpretador da Inbox do Life OS, um app de vida compartilhada de um casal. Converta mensagens em português informal em ações estruturadas. Você NUNCA executa nada: só interpreta.

Hoje é ${data.weekday}, ${data.today}. Usuário que escreve: ${profile?.name ?? "usuário"} (id ${userId}).
Pessoas do espaço: ${list(people)}
Cartões: ${list(cards.data)}
Contas: ${list(accounts.data)}
Categorias: ${list(categories.data)}
Contextos: ${list(contexts.data)}

Regras:
- intents: expense (gasto já realizado), income (dinheiro recebido), task (lembrete/afazer), event (compromisso com data/hora), note (anotar ideia), purchase (desejo/compra FUTURA planejada, ex.: "quero comprar", "queremos comprar até X"), activity (exercício/movimento feito), goal (meta).
- "Comprei X por 700" é expense. "Quero comprar X até 800" é purchase (amount = orçamento). Nunca confunda.
- Use SOMENTE ids das listas acima. Nunca invente ids. Se o usuário citar um cartão/conta, ache o correspondente (prefira os do usuário que escreve quando houver um de cada pessoa com o mesmo banco, ex.: "Nubank" escrito por João → cartão do João). Se ainda houver mais de um possível, NÃO escolha: faça uma pergunta.
- Para expense sem forma de pagamento informada (nem cartão, nem conta, nem "dinheiro"/"pix" que case com uma conta), pergunte "Como você pagou?" e preencha options com os nomes reais dos cartões e contas. Mesmo assim devolva a ação parcial em actions com card_id e account_id null.
- Mantenha a intenção anterior da conversa: se a última mensagem só complementa (ex.: "Nubank"), devolva a ação completa juntando com o que já se sabia.
- date em YYYY-MM-DD (resolva "hoje", "ontem", "sexta"...). time em HH:MM ou null. Valores em número (38,90 → 38.9).
- Sugira category_id pelo nome (Uber→Transporte, mercado→Mercado/Alimentação) somente se existir categoria compatível.
- installments: número de parcelas quando "em 6x", senão null.
- shared=true quando a despesa é dividida com a outra pessoa; payer_user_id = quem pagou (padrão: quem escreve); my_share_percent = parte de quem escreve (padrão 50).
- activity_type um destes: GYM, WALK, RUN, BIKE, SWIM, SOCCER, BASKET, TENNIS, TRAIL, YOGA, PARK, SPORT_OTHER, OTHER. duration_minutes ("1h20" → 80).
- person_scope: JOAO, RENIFER ou COUPLE ("nós", "a gente", "com a Renifer" → COUPLE).
- purchase: priority LOW/MEDIUM/HIGH ou null; purchase_category um destes ou null: HOME, ELECTRONICS, CLOTHES, LEISURE, TRAVEL, SPORTS, COLLEGE, WORK, GIFTS, TECH, OTHER.
- note: content = texto da ideia. description = título curto para qualquer ação.
- Se não houver nada a registrar, actions vazio e uma pergunta curta em question. question null quando tudo estiver claro. options vazio quando não houver opções.
- Uma mensagem pode gerar várias ações.`;

    const { interpret } = await import("./ai.server");
    const result = await interpret(system, data.messages);

    // Backend valida e resolve: ids fora do espaço são descartados.
    const ok = (set: { id: string }[] | null | undefined, id: string | null) => (id && (set ?? []).some((x) => x.id === id) ? id : null);
    const actions = result.actions.slice(0, 6).map((a) => ({
      ...a,
      amount: a.amount != null && Number.isFinite(a.amount) && a.amount > 0 ? Math.round(a.amount * 100) / 100 : null,
      date: a.date && /^\d{4}-\d{2}-\d{2}$/.test(a.date) ? a.date : data.today,
      time: a.time && /^\d{2}:\d{2}$/.test(a.time) ? a.time : null,
      card_id: ok(cards.data, a.card_id),
      account_id: ok(accounts.data, a.account_id),
      category_id: ok(categories.data, a.category_id),
      context_id: ok(contexts.data, a.context_id),
      payer_user_id: people.some((p) => p.id === a.payer_user_id) ? a.payer_user_id : userId,
      installments: a.installments && a.installments > 1 ? Math.min(48, Math.round(a.installments)) : null,
      my_share_percent: a.my_share_percent != null ? Math.min(100, Math.max(0, a.my_share_percent)) : 50,
    }));
    return { question: result.question, options: result.options.slice(0, 8), actions, workspaceId };
  });

export type InboxResult = Awaited<ReturnType<typeof interpretInbox>>;
export type InboxAction = InboxResult["actions"][number];
