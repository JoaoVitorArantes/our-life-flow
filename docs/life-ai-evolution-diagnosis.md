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
- Testes iniciais: 40 aprovados. Resultado final desta etapa registrado após a última execução abaixo; testes usam mocks/dados fictícios, incluindo defaults, datas, orçamento, campos omitidos, schema de modelo, plugins/dependências desativados, autorização anterior à persistência, escopo de workspace e falhas de read-back.
- Lint direcionado: 0 erros / 8 avisos nos componentes de chat/Inbox (Fast Refresh e dependências de memoização). Lint global: 3122 erros / 47 avisos; não aplicado autofix global nem reparos fora do pedido.
- Compilação e checagem de tipos são automáticas; não executadas manualmente.

### Limitações explícitas

Validação autenticada nesta etapa foi somente navegação do catálogo, sem consultar ou modificar registros pessoais. Criação/consulta/edição/recarga pelo chat e isolamento real João/Renifer continuam **NÃO VERIFICADOS**: exigem um espaço de teste isolado e sessão autorizada. Não houve chamada real do modelo nesta etapa; aceitação pela API e diálogo sequencial continuam **NÃO VERIFICADOS**. Não afirmar conclusão do objetivo de operar todo o sistema; os demais módulos serão integrados por contratos de domínio, em etapas, após a validação central de Contextos.