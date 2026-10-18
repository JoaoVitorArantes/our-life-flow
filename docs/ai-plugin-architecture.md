# Life AI: arquitetura incremental de capacidades

## Fronteiras

- `features/plugins/contracts.ts`: nomes fechados, metadados Zod, entradas estritas, datas/períodos válidos e saídas JSON finitas com verificação estrutural (não um schema completo por domínio).
- `action-schema.ts`: schema compartilhado das nove propostas; Inbox e agente reutilizam a mesma definição. `registry.ts` valida unicidade, dependências e cobertura; dispatcher também confere as implementações reais antes de disponibilizá-las.
- `dispatch.server.ts`: filtra discovery e reconsulta acesso imediatamente antes de cada execução. Erros de consulta/contrato não viram respostas de sucesso.
- `access.server.ts`: cliente RLS do solicitante; associação ao espaço e preferências pessoais nesse espaço. Dependências verificadas tanto para leitura quanto para propostas/confirmacão. Administração do espaço exige `workspace_can`.
- `/api/agent`: identidade autenticada e espaço da conversa acessível, nunca IDs escolhidos pelo modelo. Na confirmação, `expectedWorkspaceId` é apenas uma comparação contra o espaço ativo lido no servidor; a identidade retornada vem da sessão.
- `features/inbox/execute.ts`: continua único executor de propostas confirmadas, reutilizando mutações existentes. Confirmação é uma ação explícita da interface, não assinatura criptográfica da proposta; as políticas/mutações continuam sendo a fronteira das gravações.

## Auditoria

`ai_capability_runs` recebe apenas ator, espaço, capacidade/ferramenta, UUID de execução gerado no servidor, resultado, estado de confirmação e horário do banco. Sem argumentos, respostas, mensagens, erros crus ou credenciais. Clientes autenticados só leem seus próprios registros em espaços de que são membros; não inserem/alteram/excluem. O append administrativo ocorre somente depois de conferir associação usando o cliente RLS.

Leituras/propostas registram sucesso/falha de execução. `proposed` significa prévia, nunca gravação. Cada confirmação autorizada recebe outro UUID e `accepted`: **sucesso da autorização, não prova do sucesso da mutação posterior**. Falhas anteriores à associação e confirmações recusadas não geram registros nesta versão. Não há correlação assinada entre proposta e confirmação nem auditoria independente do resultado de toda mutação cliente; a auditoria de domínio existente permanece intacta.

## Capacidades reais

14 leituras: `financial_overview`, `transactions_summary`, `monthly_trend`, `cards_status`, `upcoming_bills`, `installments`, `nos_balance`, `goals`, `tasks`, `agenda`, `activities`, `purchases`, `routines_today`, `contexts`.

`propose_action` disponibiliza nove intents confirmáveis: `expense`, `income`, `task`, `event`, `note`, `purchase`, `activity`, `goal`, `rename_workspace`.

Preferências continuam separadas por pessoa/espaço. O catálogo distingue desativado, ativado, permissão/dependência necessária, não conectado e em breve; integrações externas não possuem botão fictício. Google Calendar, Gmail e Sheets **não são executáveis**: não há cliente autorizado do usuário nem ferramentas externas.

## Histórico e indicação visual

O corpo de chat é validado; só o último turno em texto do usuário é aceito como entrada atual. O servidor busca a continuidade via RLS, descarta partes de ferramenta e cita textos anteriores como contexto não confiável em nível de usuário. Não reproduz papéis de assistente/ferramenta como autoridade. Isso preserva continuidade textual, mas exige novas consultas para resultados atuais. Mensagens compartilhadas continuam editáveis pelos membros; o histórico não passa a ter origem comprovada e prompt injection permanece uma limitação.

O chat mantém AI Elements (`Tool`, `ToolHeader`) com execução, sucesso/falha discretos e prévias separadas dos resultados salvos.

## Verificação e próximos passos

- Vitest completo: **13 arquivos / 42 testes aprovados**, incluindo cobertura de `buildTools`, metadados, entradas/saídas, nomes desconhecidos, dependências, desativação entre discovery/execução, associação negada, confirmação revalidada, redaction e replay de histórico.
- Lint direcionado: **0 erros, 4 avisos existentes no chat**. Lint geral: **3152 erros / 47 avisos**, predominantemente dívida de formatação; não feita reformatação ampla.
- Compilação/typecheck são executados pela plataforma; consultar a última entrada automática antes de concluir, sem comandos manuais de build.
- Nenhum fluxo autenticado de João/Renifer ou chamada real de IA/integração externa foi executado. Testes usam fixtures/mocks e não alteram registros reais. Auditoria RLS hospedada ainda precisa de teste negativo com duas sessões autorizadas.
- Próximos passos com aprovação separada: procedência server-only de mensagens, correlação assinada proposta/confirmação e resultado de mutação, schemas completos de saída por domínio e integrações externas com consentimento individual. Não é preciso refazer Contextos nem suas migrations.
