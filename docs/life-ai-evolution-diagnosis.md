# Diagnóstico — evolução incremental do Life AI

## Estado inicial (18/10/2026)

- Git sem alterações locais no início da inspeção. Nenhuma alteração em configuração de bundling; a tela em branco está fora desta etapa.
- Registro fechado de 14 leituras e nove intents de proposta, validação Zod, dispatch revalidado, preferências pessoais por espaço e histórico conversacional compartilhado já implementados.
- Auditoria mínima existente em `0014_ai_capability_execution_audit.sql`; leitura protegida por ator e membership. `accepted` representa autorização, não persistência posterior.
- Contextos corrigido em `0011`; preservado integralmente.
- Catálogo já funcional, porém sem detalhes de ferramentas ou histórico de execuções. Prompt ainda contém orientações com nomes fixos.
- Confirmação revalida plugin e workspace ativo, mas não reconsulta referências de cartão/conta/categoria/contexto/pagador depois de uma prévia editada.
- Inserts de tarefas/eventos/notas/metas duplicados entre formulário rápido e executor Inbox; extração delimitada permite uma única implementação sem mudar regras financeiras.
- Prévia editável existente; falta editar conteúdo da nota, conta da receita e contexto. Estado de salvamento precisa de `finally` e proteção contra confirmações simultâneas.
- Google Calendar/Gmail/Sheets não têm ferramentas nem cliente externo autorizado. Nenhuma conexão real será criada nesta etapa.

## Verificação inicial

`bunx vitest run src/features/plugins src/lib/agent/history.test.ts`: 6 arquivos, 23 testes aprovados. `package.json` não tem script de teste; Vitest está instalado. Compilação/typecheck são automáticos da plataforma. Não executar build/typecheck manualmente.

## Delimitação

Completar detalhes e histórico pessoal no catálogo; metadados descobertos a partir do registro; revalidar referências no servidor na confirmação; extrair somente as quatro mutações simples compartilhadas; melhorar prévias existentes e regressões. Sem refatoração global, novos provedores, conexões externas, alterações de RLS, dados reais ou publicação.

Edição/exclusão por chat, criação de Contextos, check-ins de hábitos, horário/prioridade de tarefas e correlação comprovada de auditoria/persistência não serão apresentados como capacidades existentes. Dependem de contratos de domínio e testes próprios; as telas atuais permanecem disponíveis.

## Resultado e evidências desta etapa

- Detalhes de capacidades, estados e histórico pessoal no catálogo; descoberta usa os metadados do registro fechado. Referências editadas são reconsultadas com RLS na confirmação, incluindo conversa/espaço e categoria compatível.
- Quatro mutações simples compartilhadas entre formulário e Inbox. Prévia permite contexto, conta de receita e conteúdo de nota; confirmação simultânea é bloqueada e falha de sincronização do estado tem aviso explícito. Parcelamento dividido sem suporte é bloqueado, não anunciado como concluído.
- `bunx vitest run`: 17 arquivos, 59 testes aprovados. Compilação/typecheck automáticos com `build OK`; lint direcionado é registrado separadamente, sem executar compilação manual.
- Navegação autenticada somente de leitura em `/configuracoes/plugins`: detalhes, histórico, externos sem controle de ativação e recarga conferidos; sem erros de execução capturados. Sem rolagem lateral em 320, 373, 768, 1280 e 1920 px. Não confirma acesso de ambas as contas João/Renifer nem gravação posterior à confirmação.
- Nenhuma chamada real de IA, conexão externa, alteração de dados reais, migration nova ou publicação. Persistência financeira pode continuar parcial entre lançamento/parcelamento/divisão; idempotência e reconciliação não foram implementadas nesta etapa. Auditoria de confirmação comprova autorização, não a gravação subsequente.

## Nova etapa — operações unificadas e Contextos (18/10/2026)

### Causa e integração

A criação existia em `ContextDialog` e `features/contexts/queries.ts`, mas não no enum de intents, registro ou executor confirmado da IA. O problema não era a correção de Contextos em `0011` nem apenas o prompt. Essa correção foi preservada; nenhuma migration ou política foi alterada nesta etapa.

O registro agora cobre 16 leituras e 13 intents. Acrescentados `context_details`, `notes`, `create_context`, `update_context`, `archive_context` e `delete_context`; a listagem de contextos preserva os IDs reais e permite consultar arquivados. Escritas continuam como prévias, passando por autorização e reconsulta das referências no servidor antes dos mesmos serviços das telas. A execução de Contextos consulta novamente a linha no workspace autorizado antes de retornar sucesso; exclusão usa lixeira, nunca DELETE permanente.

O contrato do modelo usa campos obrigatórios/anuláveis; a normalização separa ausência de alteração de limpeza explícita (`clear_fields`). Prévia e contratos legados permanecem compatíveis. Nome é suficiente para criar; defaults são os mesmos das telas. Atualização não sobrescreve campos omitidos. As propostas não aceitam identidade, SQL, URL arbitrária nem acesso privilegiado.

### Inventário e cobertura real

| Área | Operações nas telas/serviços auditados | Exposto ao Life AI nesta etapa | Lacunas |
| --- | --- | --- | --- |
| Dashboard / Meu Dia | Indicadores e composição de tarefas, eventos e rotinas | Consultas dos módulos de origem | Não há CRUD próprio nem ferramenta dedicada |
| Financeiro | Lançamentos, edição, exclusão, cálculos, transferências | Resumo, evolução mensal, despesas/receitas confirmadas | Edição/exclusão/transferência pelo chat; reconciliação de falhas parciais |
| Contas/cartões | Cadastros, edição e arquivamento | Cartões e contas nos resultados financeiros/opções de prévia | CRUD pelo chat |
| Faturas/parcelas | Consultas, parcelas, pagamento via serviços financeiros | Próximas faturas e parcelas; criação de despesa parcelada existente | Pagamento/estorno/edição pelo chat; divisão parcelada segue bloqueada |
| Agenda | Criação/edição/exclusão de eventos; leitura pessoal do Calendar | Agenda interna e proposta de evento | Edição/exclusão; Calendar ainda não é ferramenta do agente |
| Tarefas | Criar/editar/concluir/mover para lixeira | Consulta e criação confirmada | Edição/conclusão/exclusão; horário/prioridade não são gravados pela prévia atual |
| Metas | Criar/editar/progresso/lixeira | Consulta e criação confirmada | Edição/progresso/exclusão pelo chat |
| Contextos | Criar/consultar/editar/arquivar/lixeira | Todas essas operações; escritas confirmadas com read-back | Persistência real e recarga ainda não verificadas em espaço isolado |
| Notas | Consulta/criação/edição/lixeira | Nova leitura e criação confirmada existente | Edição/exclusão pelo chat |
| Compras | Criar/editar/mudar estado/lixeira | Consulta e criação confirmada | Edição/conclusão/exclusão pelo chat |
| Rotinas/hábitos | Configuração e check-ins; ocorrências derivadas | Consulta e composição da Agenda | Alteração/check-in pelo chat; nunca persistir ocorrências como eventos/tarefas |
| Esporte | Registros e configurações de atividades | Consulta e proposta de atividade | Edição/exclusão/configuração pelo chat |
| Nós | Saldo compartilhado e acertos | Consulta de saldo compartilhado | Acertos e alterações pelo chat |
| Control Center | Identidade, categorias, membros, preferências, plugins, lixeira, exportação e atividade | Renomear workspace confirmado com permissão; descoberta dos plugins | Demais operações administrativas/exportação/lixeira/histórico pelo chat |
| Google | Calendar individual na Agenda; consentimento separado | Nenhuma ferramenta externa nova | Calendar no agente, Gmail e Sheets após validação pessoal |

### Fluxos sequenciais e resultados

Contexto → gasto: propor primeiro o contexto, aguardar confirmação e consultar seu ID real antes da proposta financeira; manter valor, descrição e forma de pagamento fornecidos. Teste isolado comprova o encaminhamento de R$120 e ID de contexto retornado, mas não prova raciocínio do modelo nem persistência financeira real. Histórico continua como texto não confiável, não recibo de execução. Não existe transação/idempotência multi-operação nova; qualquer falha interrompe a execução atual e não autoriza a seguinte.

### Arquivos e checagens

- Contratos/executor/testes: `features/contexts/{ai-contract,execute-confirmed,test-action}*`, `features/contexts/queries.ts`, `features/inbox/execute*`.
- Registro/autorização: `features/plugins/{contracts,action-schema,registry,capabilities,references.server,references.test}.ts`.
- Agente/Inbox: `lib/agent/tools.server.ts`, `routes/api/agent.ts`, `lib/inbox/{ai.server,inbox.functions}.ts`, `components/agent/agent-chat.tsx`, `components/inbox/{context-fields,inbox-assistant}.tsx`.
- Documentação/arquitetura: esta nota, `roadmap.md` e regra compacta em `AGENTS.md`. Nenhuma mudança em bundling, banco, políticas, correção de Contextos ou publicação.
- Testes iniciais: 40 aprovados. Resultado final: `bunx vitest run`, 23 arquivos / 98 testes aprovados; testes usam mocks/dados fictícios, incluindo defaults, datas, orçamento, campos omitidos, schema de modelo, plugins/dependências desativados, autorização anterior à persistência, escopo de workspace e falhas de read-back.
- Lint direcionado: 0 erros / 8 avisos nos componentes de chat/Inbox (Fast Refresh e dependências de memoização). Lint global: 3122 erros / 47 avisos; não aplicado autofix global nem reparos fora do pedido.
- Compilação e checagem de tipos automáticas: `build OK` em 18/10/2026 às 03:22:06 UTC; não executadas manualmente.

### Limitações explícitas

Validação autenticada nesta etapa foi somente navegação do catálogo, sem consultar ou modificar registros pessoais. Criação/consulta/edição/recarga pelo chat e isolamento real João/Renifer continuam **NÃO VERIFICADOS**: exigem um espaço de teste isolado e sessão autorizada. Não houve chamada real do modelo nesta etapa; aceitação pela API e diálogo sequencial continuam **NÃO VERIFICADOS**. Não afirmar conclusão do objetivo de operar todo o sistema; os demais módulos serão integrados por contratos de domínio, em etapas, após a validação central de Contextos.
## Etapa 20/10/2026 — chat e fundação acadêmica

### Fase 1 — causa demonstrada do erro do chat

O `DefaultChatTransport` do AI SDK v7.0.127 envia `{ ...body, id, messages, trigger, messageId }`; o `agentBodySchema` estrito rejeitava `id`, `trigger` e `messageId`, gerando 400 "Mensagem inválida." em toda mensagem. Prova: `src/lib/agent/transport-payload.test.ts` captura o envelope real do transporte (fetch stub, sem sessão nem dados) e falhava antes da correção. Correção mínima: schema aceita os três campos opcionais validados (ignorados pelo handler), mantendo `.strict()`, rejeição de texto inválido, autenticação Bearer e workspace derivado da conversa via RLS. Endpoint sem credenciais responde 401 antes de ler o corpo.

### Fase 2 — módulo Faculdade (fundação)

Auditoria confirmou que só existia um placeholder. Migration aditiva `0016_academic_foundation.sql`: `academic_terms`, `academic_courses`, `academic_evaluations`, `academic_sessions` — todas com `workspace_id`, RLS por membro (`user_is_workspace_member`), grants authenticated/service_role, sem seed. Módulo em `src/features/academic/` (contratos Zod, consultas, mutações com read-back sob RLS, importação CSV/JSON com prévia validada) e página `faculdade.tsx` reescrita: BSI/UFU, currículo 2022-2, ingresso 2025; as quatro pendências (Algoritmos e Programação, Arquitetura e Organização de Computadores, Cálculo I, Fundamentos de Marketing) registradas só por ação do usuário, marcadas como informação declarada, com semestre/nota/requisitos/datas desconhecidos; progresso e frequência sempre sinalizam dados faltantes e nunca se apresentam como oficiais.

Plugin "academico" no registry central: ferramenta de leitura `academics` e intents `create_evaluation`/`log_class` com confirmação explícita, revalidação da disciplina no ponto de confirmação (references.server) e read-back após gravação. Prévias legadas continuam confirmáveis (campos novos preenchidos com null na execução); o schema do modelo segue estrito com todas as propriedades obrigatórias.

Verificações: 25 arquivos / 107 testes aprovados (`bunx vitest run`); `tsgo --noEmit` limpo; build OK 01:02 UTC; lint direcionado 0 erros novos (1 erro de formatação pré-existente em `features/inbox/history.ts`, não tocado; 8 avisos pré-existentes de hooks no chat).

### Lacunas que dependem de dados do usuário

Grade oficial, pré-requisitos reais, notas, frequência mínima e calendário acadêmico dependem de matrícula/dados da instituição — o módulo registra e sinaliza ausências, não inventa. Gravação acadêmica real via chat e isolamento João/Renifer seguem NÃO VERIFICADOS (requerem espaço de teste isolado e sessões autorizadas). Nenhuma publicação; nenhum dado real alterado.

## Etapa 20/10/2026 (2) — Faculdade privada por pessoa

Migration aditiva `0017_academic_owner_privacy.sql` **criada e aplicada** no banco de preview: `owner_id` (NOT NULL, backfill apenas de `created_by`, sem ler conteúdo) nas quatro tabelas acadêmicas; políticas refeitas para exigir `owner_id = auth.uid()` + membro do workspace (SELECT/UPDATE/DELETE) e `owner_id = created_by = auth.uid()` no INSERT; WITH CHECK do UPDATE impede transferência de dono. Integridade: UNIQUE `(id, workspace_id, owner_id)` em períodos e disciplinas, FKs compostas de avaliações/aulas para disciplina do mesmo dono+workspace (CASCADE) e trigger `validate_academic_term_owner` para disciplina→período. Migration 0016 preservada.

Cliente: consultas, mutações, importação e read-back escopados por `owner_id = userId` (chaves do React Query incluem o usuário). Servidor: ferramenta `academics` filtra por dono; `validateActionReferences` recebe o usuário autenticado e exige disciplina do próprio dono na proposta e na confirmação. Navegação: `academicNavItems` gera um atalho por membro real ("Faculdade — <primeiro nome>"), usuário autenticado primeiro; `/faculdade` redireciona para a visão própria e `/faculdade/$ownerId` mostra estado "Sem acesso" (sem consultas nem gravação) quando o dono não é o usuário da sessão — o RLS é a última barreira.

Verificações: 27 arquivos / 129 testes aprovados; `tsgo --noEmit` limpo; build OK 01:12 UTC; lint direcionado 0 erros/0 avisos. Novos testes: contrato do SQL da 0017 (owner-scope.test.ts), atalhos e guarda de rota (navigation.test.ts), revalidação por dono com curso de outra pessoa rejeitado (references.test.ts).

Limitações: verificação autenticada na prévia NÃO realizada nesta etapa (aprovação de sessão indisponível no contexto); isolamento real João/Renifer verificado por contrato/testes, não por sessões ao vivo. Preferências de navegação (ocultar/ordenar) passam a usar as chaves por pessoa `/faculdade/<id>`; a chave antiga `/faculdade` não oculta os novos atalhos. Nenhuma publicação; nenhum dado real lido ou alterado.

## Etapa 20/10/2026 (3) — Faculdade compartilhada entre membros (correção de requisito)

A privacidade por pessoa da 0017 foi revertida por decisão do usuário: a Faculdade é **compartilhada** entre João e Renifer; `owner_id` passa a identificar apenas o **aluno** (organização visual), não confidencialidade.

Migration aditiva `0018_academic_shared_members.sql` **aplicada no preview**: FKs compostas `academic_*_owner_member_fkey (workspace_id, owner_id) → workspace_members(workspace_id, user_id)` nas quatro tabelas (UNIQUE(workspace_id, user_id) confirmado em `pg_constraint`), garantindo que todo perfil acadêmico pertence a um membro real do espaço; políticas refeitas — SELECT/UPDATE/DELETE exigem apenas membro do workspace, INSERT exige membro + `created_by = auth.uid()` (dono validado pela FK). Preservadas: FKs compostas avaliação/aula→disciplina do mesmo dono, trigger `validate_academic_term_owner`, backfill da 0017. Nenhum registro lido, apagado ou reparado.

Cliente: submenu "Faculdade" com um subitem por membro rotulado com o primeiro nome real ("João", "Renifer"; "Membro" como fallback sem inventar nome), expansível na sidebar e no menu mobile, ativo quando a rota do submenu está aberta; `/faculdade` redireciona ao perfil do usuário da sessão; `/faculdade/$ownerId` mostra "Faculdade — <nome>" e o estado "Perfil acadêmico não encontrado" apenas para ownerId fora do workspace. Consultas, mutações, importação e read-back distinguem aluno-alvo (`owner_id` selecionado) de autor (`created_by` da sessão); chaves do React Query incluem o ownerId.

IA: ferramenta `academics` aceita `owner_id` opcional validado contra membros reais (sem ele, usa o usuário da sessão); `validateActionReferences` revalida a disciplina apenas por workspace (sem filtro de dono); a execução de `create_evaluation`/`log_class` resolve o `owner_id` da **própria disciplina** antes de gravar — o modelo nunca escolhe o dono — e retorna o link do perfil correto. O prompt do agente orienta o uso do `owner_id` da tela `/faculdade/<id>`.

Verificações: 27 arquivos / 137 testes aprovados; `tsgo --noEmit` limpo; lint direcionado 0 erros/0 avisos. Novos/ajustados: contrato SQL 0017+0018 (owner-scope.test.ts), submenu e guarda por membro (navigation.test.ts), revalidação compartilhada com disciplina de outro membro aceita e fora do workspace rejeitada (references.test.ts), execução gravando no perfil do dono da disciplina com sessão de outro membro (execute.test.ts).

Limitações: verificação autenticada na prévia NÃO realizada (sessão não injetada; `--self` sem conta correspondente; `--user` exigiria aprovação indisponível no contexto). Comportamento compartilhado verificado por contrato/testes, não por sessões ao vivo. Nenhuma publicação; nenhum dado real lido ou alterado.
