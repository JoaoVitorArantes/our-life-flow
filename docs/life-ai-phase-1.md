# Life AI — Fase 1: fundação incremental

## Escopo e resultado

O projeto existente mantém o assistente global, conversas compartilhadas, consultas atuais e confirmação antes de salvar. Esta fase não adiciona catálogo de plugins, telas, OAuth, cadastro/validação de chaves, chamadas a conectores externos ou tabelas de credenciais. Nenhuma alteração de dados, RLS, contas externas, publicação ou visibilidade foi realizada.

O catálogo novo trazido pela revisão a6f08c42 foi retirado, sem reverter o merge inteiro. Foram removidos `src/features/plugins/`, `src/routes/_authenticated/configuracoes.plugins.tsx` e `docs/ai-plugins.md`, além da entrada de Configurações e dependências de plugins no agente e executor. A árvore de rotas é regenerada pela plataforma, não editada manualmente. Plugins de apresentação preexistentes (Streamdown, carrossel) permanecem. O diff de dependências contra a baseline mostra somente atualização gerenciada do template e Vitest, necessário aos testes; não há pacote exclusivo de catálogo a remover.

**Migration mista 0012:** já aplicada e também contém `validate_context_input`. Não foi apagada, editada ou revertida; `ai_plugin_preferences` permanece como esquema legado não consumido pelo código. Os tipos gerados correspondentes permanecem. Remover uma tabela ou reescrever o histórico aplicado contrariaria a preservação de schema/RLS e demandaria aprovação separada. Não há migration nova nesta fase.

## Inventário revalidado

| Área | Evidência e comportamento atual |
| --- | --- |
| Superfície global | `src/components/agent/global-agent.tsx`, `agent-launcher.tsx`, `agent-chat.tsx`; reutilizada no app-shell. A central continua em `/inbox` e `/inbox/$threadId`. |
| Provider/modelo | `@ai-sdk/openai`, Lovable AI Gateway, protocolo Responses, `openai/gpt-6-astra`; contrato atual em `contracts.ts`. O interpretador legado de Inbox usa o mesmo modelo em `src/lib/inbox/ai.server.ts`. Credencial lida somente no servidor. |
| Telemetria | Inventário imediatamente anterior consultou 13 pedidos do Gateway: mesmo modelo, Responses, HTTP 200. Não foi enviada nova mensagem/model request nesta fase. Sucesso anterior não comprova o chat autenticado atual. |
| API | `src/routes/api/agent.ts`: valida sessão, lê conversa com cliente do usuário, deriva workspace da conversa; transmite resposta e persiste mensagens. Não aceita workspace/user IDs escolhidos pelo modelo. |
| Ferramentas | `src/lib/agent/tools.server.ts`: 15 ferramentas com schemas Zod; consultas com workspace explícito e RLS. `loadBase` resolve IDs visíveis de contas/cartões/categorias/contextos/pessoas/metas. |
| Intents | `actionSchema`: expense, income, task, event, note, purchase, activity, goal, rename_workspace. IDs de propostas são confrontados com listas acessíveis. |
| Execução | `propose_action` devolve proposta, sem gravação. `AgentChat` mostra prévia e `executeAction` só é chamado após Confirmar, reutilizando mutações de formulário. Renomear continua sujeito a `update_workspace_identity`/`workspace_can`. |
| Histórico | `ai_conversations` e `ai_messages` guardam UIMessage JSON compartilhado pelo espaço; `conversations.ts` lê sob RLS. Políticas hospedadas reconsultadas nesta fase. |
| Sincronização | `workspace_sync_events`, uma assinatura por workspace; invalidação de React Query. Sem novo canal/agente ou publicação Realtime. |
| Edge Functions | Fluxo atual utiliza rota TanStack e server functions; nenhum uso de `functions.invoke` nem diretório de funções encontrado nos caminhos inventariados. Isso não comprova ausência de funções remotamente implantadas: inventário remoto de Edge Functions não disponível nesta verificação. |
| Conectores reais | Catálogo App User disponível na Lovable; nenhum cliente vinculado ao projeto identificado no inventário anterior. Reconsulta de clientes Calendar, Gmail e Sheets retornou nenhum configurado. Google Search Console é uma conexão App Connector do construtor vinculada ao projeto, não consentimento de usuários finais; não foi utilizada. |

As 15 ferramentas são: financial_overview, transactions_summary, monthly_trend, cards_status, upcoming_bills, installments, nos_balance, goals, tasks, agenda, activities, purchases, routines_today, contexts, propose_action.

Notas só têm proposta, não leitura dedicada. Contextos e Rotinas têm leitura, não novo intent de criação/edição. Agenda combina eventos, tarefas e ocorrências derivadas; ocorrências não são persistidas como eventos. Não se afirma capacidade externa ou módulo de IA que não existe.

## Arquitetura e contratos

```text
GlobalAgent / Inbox → AgentChat → API autenticada → Provider (gera resposta)
                                    ↓
                          registro fechado de tools
                                    ↓
                      autorização atual + schema Zod
                                    ↓
                    handlers existentes / cliente com RLS

propose_action → prévia → Confirmar → executeAction → mutações existentes/RLS

Connector (futuro): acesso a serviço; separado de Provider e Tool
```

- **Provider:** modelo/protocolo que interpreta e gera; não é conta conectada nem autorização para consultar dados.
- **Connector:** acesso autenticado a serviço externo, com modo workspace ou app_user, estado e escopos. O contrato contém só metadados não secretos; não há implementação ou despacho externo nesta fase.
- **Tool:** capacidade executável conhecida. `AgentToolId` e `TOOL_CONTRACTS` identificam fonte interna, efeito read/propose, RLS e fluxo de confirmação. Nenhuma ferramenta de escrita direta é registrada.
- **Dispatch:** `registerAgentTools` mantém schemas, descrições e retornos existentes; rejeita nomes desconhecidos, executores ausentes e schemas não Zod. Revalida parâmetros mesmo se chamado fora do SDK. Antes de cada execução, o servidor consulta `is_workspace_member` com o cliente da sessão, falhando fechado inclusive em erro. Não usa admin ou permissões declaradas pelo modelo.
- **Permissões:** leituras preservam as regras existentes de associação/visibilidade nas políticas. Mutações confirmadas permanecem nos caminhos atuais, sujeitos a RLS/RPC. Esta fundação não cria novas permissões, nem faz do clique Confirmar um mecanismo de autorização.
- **Consentimento:** ferramentas internas não exigem autorização de conta externa; qualquer conector futuro exige identidade/consentimento adequado antes de ser registrável. Não existe tool de URL arbitrária ou código dinâmico.

Os metadados read/propose descrevem o contrato e não provam que uma implementação futura seja livre de efeitos colaterais. A segurança atual depende também dos handlers fechados revisados; adicionar tool exige revisão de implementação, schema e testes. Não se promete sandbox de código arbitrário ou proteção completa contra prompt injection.

## Auditoria: achados preservados e limites

Referência: `docs/security-functionality-audit.md`. Reconsulta somente leitura confirmou:

| Severidade | Evidência atual | Tratamento nesta fase |
| --- | --- | --- |
| Alta | API recebe `messages: z.array(z.any())`; histórico cliente pode incluir resultados alegados. Políticas de mensagens permitem escrita/alteração por membros. | Não alterado: histórico canônico/validação profunda dependem de aprovação. Fundação não soluciona falsificação de histórico ou resposta fabricada. |
| Alta | `goal_contributions_select` confere membership, sem visibilidade da meta pai. | Não alterado: revisão de acesso depende de aprovação. |
| Média | `cip_update` confere membership, sem conferir vínculo cartão/workspace como INSERT. | Não alterado; permanece no relatório de auditoria. |
| Média | Entrada total/quota da IA não têm controle específico comprovado; stepCountIs(50) limita etapas, não quota por usuário. | Sem adição de limite próprio ou mudança de comportamento. |
| Informativa | Inventário remoto de Edge Functions, consumo externo e chat autenticado não comprovados nesta execução. | Explicitamente não verificados. |

Nenhum novo achado Crítico confirmado. Não foi feita nova varredura completa de dependências/bundle publicado; limitações e dívida de lint da auditoria continuam válidas.

**Contextos preservados:** funções hospedadas relidas confirmam `audit_created_record` usando `name` para Contextos (em vez de `title`, causa do save failure) e `validate_context_input` com limites, intervalo de datas, orçamento finito não negativo, cor e URL de capa. INSERT/UPDATE continuam exigindo autoria e associação, SELECT continua respeitando visibilidade e soft-delete. Nenhum contexto foi criado, editado ou excluído nesta fase. Criação/edição, opcionais em branco, recarga e isolamento real continuam pendentes de sessão autorizada; inspeção SQL/testes unitários não substituem esse fluxo.

## Validação e arquivos

- Novos: `src/lib/agent/contracts.ts`, `dispatch.ts`, `dispatch.test.ts`, `tools.test.ts`, este documento.
- Alterados: `tools.server.ts`, `src/routes/api/agent.ts`, `src/features/inbox/execute.ts`, `src/features/settings/sections.ts`, `AGENTS.md`, `roadmap.md`; exclusões do catálogo descritas acima.
- Testes seguros: Vitest, 9 arquivos / 23 testes, incluindo 3 testes de despacho (registro fechado, associação negada sem execução, parâmetros inválidos/retorno preservado), 1 teste do handler real de proposta com cliente simulado (IDs inacessíveis descartados, sem gravação), Contextos, orçamento, exportação, finanças e rotinas. A contagem difere dos 29 anteriores porque foram removidos os 10 testes exclusivos do catálogo e adicionados 4 da fundação. Testes simulados não comprovam acesso autenticado real.
- Lint direcionado aos arquivos desta fase: passou. Lint geral já documentado com 3.118 erros/47 avisos, não corrigido fora do escopo.
- Tipos/compilação: verificação automática da plataforma, sem execução manual de build/typecheck; última entrada conferida em `/tmp/observability/build-errors.log`: `build OK`, 17/10/2026 20:52:41 UTC. Incompatibilidades de tipos nos novos testes foram corrigidas antes dessa verificação.
- Sessão: estado `signed_out`; tentativa anterior de sessão própria falhou. Nenhuma conta alheia selecionada. Sem validação ponta a ponta autenticada ou criação de registros temporários, sem limpeza pendente.

## Fase 2 — requisitos, não implementados

1. Aprovar separadamente endurecimento do histórico e demais achados de acesso; definir histórico canônico com RLS e compatibilidade com conversas compartilhadas antes de afirmar integridade de resultados.
2. Escolher serviço, escopos mínimos e finalidade: identidade, dados do construtor ou dados de cada usuário são modos distintos. Verificar catálogo/configuração real; disponibilidade de catálogo não é conexão.
3. Para dados pessoais, configurar/vincular cliente App User Connector por administrador, permitir offline access quando necessário, implementar consentimento individual e troca de código somente no servidor; armazenar handles criptografados por identidade autenticada e connector_id. Sem slots compartilhados ou chaves no navegador.
4. Definir revogação/reconexão, permissões por tool, confirmação explícita para escritas/destruição/envios externos, erros seguros e revisão de logs. Nenhuma credencial/tabela é criada agora.
5. Se cadastro BYOK vier a ser aprovado, especificar política de armazenamento/validação segura e restrição de endpoints, sem URLs arbitrárias/SSRF ou segredos enviados ao cliente. Esta fase não habilita BYOK.
6. Autorizar e executar testes ponta a ponta com conta correta: consultas reais, proposta sem gravação antes de Confirmar, persistência/recarga, isolamento entre espaços e parceiros, comportamento global/mobile. Novos canais (ex.: WhatsApp) permanecem dependências futuras, não implementação atual.