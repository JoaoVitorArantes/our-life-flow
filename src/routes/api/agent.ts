import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const bodySchema = z.object({
  threadId: z.string().uuid(),
  messages: z.array(z.any()).min(1).max(200),
  pageContext: z.string().max(300).optional(),
});

function spToday() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const weekday = now.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
  });
  const time = now.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
  return { iso: parts, weekday, time };
}

function json(status: number, error: string) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/agent")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!url || !key || !apiKey) return json(500, "O assistente não está configurado.");
        if (!auth?.startsWith("Bearer ")) return json(401, "Entre na sua conta para conversar.");

        const supabase = createClient<Database>(url, key, {
          global: { headers: { Authorization: auth } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: claims, error: authError } = await supabase.auth.getClaims(auth.slice(7));
        const userId = claims?.claims?.sub;
        if (authError || !userId) return json(401, "Sessão expirada. Entre novamente.");

        const parsed = bodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json(400, "Mensagem inválida.");
        const messages = parsed.data.messages as UIMessage[];

        // Workspace SEMPRE derivado da conversa + sessão (RLS garante que é do usuário).
        const { data: thread } = await supabase
          .from("ai_conversations")
          .select("id, workspace_id, title")
          .eq("id", parsed.data.threadId)
          .maybeSingle();
        if (!thread) return json(404, "Conversa não encontrada.");
        const workspaceId = thread.workspace_id;

        const today = spToday();
        const ctx = { supabase, workspaceId, userId, today: today.iso };
        const { loadBase, buildTools } = await import("@/lib/agent/tools.server");
        const base = await loadBase(ctx);
        const tools = buildTools(ctx, base);
        const me = base.people.find((p) => p.me);
        const list = (v: unknown) => JSON.stringify(v);

        const instructions = `Você é o Life OS AI, o assistente pessoal do Life OS — o app de vida compartilhada de ${base.people.map((p) => p.name.split(" ")[0]).join(" e ")}. Fale português do Brasil, natural, direto e amigável, como um amigo organizado. Sem formalidade ("De acordo com os dados...") e sem jargão técnico.

Agora: ${today.weekday}, ${today.iso}, ${today.time} (horário de Brasília). Quem está falando: ${me?.name ?? "usuário"} (id ${userId}).
Espaço: ${list(base.workspace)}
Pessoas: ${list(base.people)}
Cartões: ${list(base.cards.filter((c) => c.is_active).map((c) => ({ id: c.id, name: c.name, owner_id: c.owner_id })))}
Contas: ${list(base.accounts.filter((a) => a.is_active).map((a) => ({ id: a.id, name: a.name, type: a.account_type, owner_id: a.owner_id })))}
Categorias: ${list(base.categories)}
Contextos: ${list(base.contexts)}
Contexto da tela atual: ${parsed.data.pageContext ?? "não informado"}. Use isso apenas para entender referências como “aqui”, “esta meta” ou “essa compra”. O contexto não limita suas consultas nem ações e nunca substitui os dados das ferramentas.

COMO AGIR
- Você TEM acesso aos dados reais pelas ferramentas. NUNCA peça ao usuário dados que estão no app e NUNCA diga que não tem acesso. Para qualquer pergunta sobre a vida/dados dele, chame as ferramentas antes de responder.
- NUNCA invente números. Use apenas o que as ferramentas devolverem. Se uma ferramenta devolver erro, diga com naturalidade que não conseguiu consultar aquilo agora.
- Converta datas relativas (hoje, ontem, semana passada, mês passado, setembro, últimos 30 dias, até o fim do mês, sexta) em datas reais a partir de hoje antes de consultar. "Esse mês" = do dia 1 até o último dia do mês atual.
- Os dados são do casal: fale em "vocês" para finanças compartilhadas. Quem registrou é só identificação. Para "quanto a Renifer gastou", filtre por person_id dela.
- Mantenha o contexto: "E em agosto?" repete o mesmo indicador para outro período; "e a Renifer?" mantém o período anterior.
- Dinheiro Livre, "quanto posso gastar", "posso comprar X": use financial_overview (mesmo cálculo do app). Para "posso comprar X por Y", compare Y com dinheiro_livre e menor saldo.
- Análises ("estou gastando muito com comida?"): compare período atual com anterior/média via monthly_trend. Se não houver histórico suficiente, diga isso.
- "Como está minha vida?": combine financial_overview, tasks(overdue/today), agenda(hoje), goals, activities(semana), routines_today e responda em um resumo curto por área.
- REGISTROS (gastei, recebi, cria tarefa, anota, marca academia, quero comprar, registra na meta): use propose_action. Nada é salvo até o usuário tocar em Confirmar na prévia — então diga algo curto como "Confere a prévia 👇" e não diga que já salvou.
  - "Comprei X" = expense; "quero comprar X até Y" = purchase. Cartão citado: ache pelo nome; se existir um de cada pessoa com o mesmo banco, prefira o de quem fala; se ainda for ambíguo, pergunte "Qual Nubank?" listando as opções reais.
  - Despesa sem forma de pagamento: pergunte "Como você pagou?" com as opções reais ANTES de propor. Quando o usuário responder ("Nubank"), complete a despesa anterior — não comece outra.
  - Campos: date YYYY-MM-DD; time HH:MM ou null; amount número; category_id só se houver categoria compatível; installments para "em 6x"; shared=true quando dividida com a outra pessoa (payer_user_id = quem pagou, my_share_percent padrão 50); activity_type em GYM, WALK, RUN, BIKE, SWIM, SOCCER, BASKET, TENNIS, TRAIL, YOGA, PARK, SPORT_OTHER, OTHER; duration_minutes ("1h20"→80); person_scope JOAO, RENIFER ou COUPLE; priority LOW/MEDIUM/HIGH; purchase_category HOME, ELECTRONICS, CLOTHES, LEISURE, TRAVEL, SPORTS, COLLEGE, WORK, GIFTS, TECH, OTHER; note: content = texto. Campos irrelevantes = null.
  - "Mude o nome do nosso espaço para X": propose_action com intent rename_workspace e description = X. É ação administrativa: só acontece após Confirmar.
  - Você ainda não pode editar ou excluir registros existentes: explique e indique onde fazer no app.
- Respostas curtas por padrão (1–3 frases). Pergunta complexa → mais detalhe, com listas curtas. Valores em R$ no formato brasileiro (R$ 1.234,56). Use markdown leve (negrito em números-chave).
- Ao final de respostas de consulta, quando fizer sentido, ofereça UMA próxima ação curta. Não mostre nomes de ferramentas, ids ou códigos internos.`;

        const provider = createOpenAI({
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey,
          headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
          fetch: (() => {
            let runId: string | undefined;
            return async (input: RequestInfo | URL, init?: RequestInit) => {
              const headers = new Headers(init?.headers);
              if (runId && !headers.has("X-Lovable-AIG-Run-ID"))
                headers.set("X-Lovable-AIG-Run-ID", runId);
              const res = await fetch(input, { ...init, headers });
              runId ??= res.headers.get("X-Lovable-AIG-Run-ID")?.trim() || undefined;
              return res;
            };
          })(),
        });

        const result = streamText({
          model: provider.responses("openai/gpt-6-astra"),
          instructions,
          messages: await convertToModelMessages(messages.slice(-40)),
          tools,
          stopWhen: stepCountIs(50),
          abortSignal: request.signal,
          providerOptions: {
            openai: {
              forceReasoning: true,
              reasoningEffort: "low",
              reasoningSummary: "auto",
              store: false,
              include: ["reasoning.encrypted_content"],
            },
          },
        });

        const lastUser = [...messages].reverse().find((m) => m.role === "user");
        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          sendReasoning: false,
          onError: (error) => {
            console.error("[agent] stream", error);
            const status = (error as { statusCode?: number })?.statusCode;
            if (status === 402)
              return "Os créditos de IA do espaço acabaram. Adicione créditos para continuar.";
            if (status === 429)
              return "Muitas mensagens em pouco tempo. Tente de novo em instantes.";
            return "Não consegui responder agora. Tente de novo.";
          },
          onFinish: async ({ responseMessage }) => {
            const rows = [lastUser, responseMessage]
              .filter((m): m is UIMessage => !!m && m.parts.length > 0)
              .map((m) => ({
                conversation_id: thread.id,
                workspace_id: workspaceId,
                message_id: m.id,
                role: m.role,
                message: m as never,
              }));
            const { error } = await supabase
              .from("ai_messages")
              .upsert(rows, { onConflict: "conversation_id,message_id" });
            if (error) console.error("[agent] persist", error);
            const firstText = lastUser?.parts.find((p) => p.type === "text");
            const patch: { updated_at: string; title?: string } = {
              updated_at: new Date().toISOString(),
            };
            if (thread.title === "Nova conversa" && firstText && "text" in firstText)
              patch.title = firstText.text.slice(0, 60);
            const up = await supabase.from("ai_conversations").update(patch).eq("id", thread.id);
            if (up.error) console.error("[agent] title", up.error);
          },
        });
      },
    },
  },
});
