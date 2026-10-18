# Life OS — auditoria de segurança e funcionamento

## Escopo e limites

Revisão em 17/10/2026 do projeto existente. Sem publicação, ações externas ou alterações de registros reais. Novos plugins estão pausados; testes do registro já existente não representam nova implementação.

Esta revisão combina inspeção do código, consultas somente de leitura ao banco hospedado, verificações automatizadas e navegação pública. Não equivale a pentest nem certificação de segurança. Não foi possível obter sessão autorizada: a sessão estava desconectada e a tentativa de autorização da própria conta não encontrou correspondência. Nenhuma conta alheia foi escolhida.

## Contextos: causa comprovada e correção

O erro de operação observado foi `record "new" has no field "title"`. O trigger de criação `audit_created_record` tratava Contextos como registros com `title`, mas a tabela tem `name`. A migração `0011_fix_context_creation_audit.sql` corrige a seleção do rótulo através de `to_jsonb(NEW)`. Consulta ao banco hospedado confirmou a definição corrigida. Nenhuma política de Contextos foi enfraquecida.

O formulário verifica usuário e workspace ativos, envia campos opcionais vazios como `null`, datas `YYYY-MM-DD`, e orçamento numérico. A validação cobre datas reais, ordenação das datas, orçamento finito não negativo, cor hexadecimal e endereço http/https da capa. Trigger do banco mantém validação adicional; INSERT exige associação ao workspace e autoria autenticada. UPDATE exige autoria e associação. SELECT oculta itens excluídos e respeita visibilidade privada/compartilhada.

Nesta revisão, o orçamento ganhou parser estrito: entradas inválidas não viram zero silenciosamente. Erros apresentados ao usuário não incluem SQL, stack ou segredos.

**Verificado:** causa, definição corrigida no banco, schema/defaults, políticas e validação automatizada. **Pendente:** criação e edição pelo modal autenticado, recarga com leitura do registro e tentativa por segundo workspace. Não alegamos que esses fluxos passaram. O banco manteve três contextos; a comparação de contagem/fingerprint anterior e posterior às alterações de segurança não indicou alteração dos registros.

## Achados com evidências

| Severidade | Achado e evidência | Resultado / próximo passo |
| --- | --- | --- |
| Alta | `storage.objects`, política `Workspace members can view profile avatars`: compartilhamento pelo uploader não exigia pasta pessoal. Um usuário que compartilha um workspace com o uploader poderia ler objetos de imagem de outro workspace enviados pela mesma pessoa. | Corrigido pela migração `0013_restrict_shared_profile_avatar_reads`: compartilhamento pessoal exige primeiro segmento da pasta igual a `owner_id`; imagens de workspace continuam sob a política de associação ao workspace do caminho. Definição hospedada conferida; teste com duas sessões ainda pendente. |
| Alta | `src/routes/api/agent.ts`: `messages` aceita `z.any()` e o histórico enviado pelo cliente entra diretamente em `convertToModelMessages`. É possível fornecer mensagens de assistente/ferramenta fabricadas como contexto, induzindo conclusões ou propostas sem resultado real. | Revisão incremental de 18/10/2026: corpo validado, somente o último turno de usuário em texto é usado; continuidade é lida via RLS e citada como contexto não confiável, sem replay de resultados/papéis de ferramenta. Membros ainda podem editar mensagens armazenadas; não há garantia de procedência ou imunidade a prompt injection. Ver docs/ai-plugin-architecture.md. |
| Alta | `goal_contributions_select` permite leitura por associação ao workspace sem exigir que a meta pai seja visível. `goals_select` protege metas privadas; aportes podem revelar valores, datas e descrição de uma meta privada cujo ID não se pode consultar. | Comprovado pela diferença entre políticas, não por exploração autenticada. Consulta agregada encontrou zero aportes ligados a metas privadas atualmente. Restringir aos pais visíveis precisa aprovação por modificar leitura compartilhada e comportamento de restauração. |
| Média | `card_invoice_payments`: INSERT confere cartão/workspace, mas UPDATE não repete essa conferência; `prevent_workspace_move` protege workspace, não a troca de cartão. | Revisar vínculo em UPDATE com trigger/política dedicada. Não afirmamos que foi explorado. |
| Média | Pagamentos de fatura não têm teto atômico comprovado no banco; `safe-to-spend.ts` subtrai pagamentos do compromisso aberto. A interface direciona valores maiores ao pagamento integral, mas concorrência/chamada direta não têm essa proteção. | RPC transacional e teste concorrente recomendados; não alterar cálculos financeiros sem cobertura autenticada. |
| Média | `src/features/finance/mutations.ts`: certas operações financeiras envolvem várias gravações sequenciais. Uma falha intermediária pode deixar operação parcial. | Consolidar operações críticas em transações/RPCs após aprovação; nenhum dado alterado durante a revisão. |
| Média | `src/features/export/export.ts`: texto com prefixo `=`, `+`, `-` ou `@` poderia ser interpretado como fórmula em planilha. | Corrigido: texto de fórmula recebe apóstrofo; números negativos permanecem números. Dois testes passaram. |
| Média | `/api/agent` limita quantidade de mensagens e passos, mas não apresenta limite total de bytes/texto ou quota local persistente por usuário. | Limites do provedor não substituem controle de abuso por conta. Priorizar validação e quota persistente. |
| Baixa | Lint geral falha em 3.118 erros e 47 avisos: 3.117 erros de formatação e um `prefer-const` em arquivo gerenciado de autenticação. | Não foi feita reformatação geral nem edição de arquivo gerenciado. Arquivos desta revisão passam no lint direcionado. |
| Informativa | PWA tem manifesto e ícone servidos, sem registro de service worker encontrado. | Não oferece garantia de dados offline. Testes Android/instalação fora deste escopo. |
| Informativa | Tema claro salvo pode apresentar tema escuro inicialmente; marcação ativa de navegação aninhada merece validação autenticada. | Inspeção de código, não regressão reproduzida. |

Nenhum achado Crítico confirmado. Ausência de achado não demonstra ausência de vulnerabilidade.

### Controles confirmados por inspeção

- RLS habilitado em todas as tabelas públicas inventariadas; políticas de domínio usam associação/identidade. Nenhum grant de tabela pública para `anon` retornou na consulta realizada. Isso não substitui testes negativos autenticados de cada operação.
- Exportação filtra `workspace_id`, pagina resultados e utiliza o cliente sujeito a RLS. JSON/CSV não usam chave administrativa.
- `list_trash` exige associação ao workspace solicitado; registros privados ficam limitados ao autor. A definição hospedada de `trash_record` verifica autoria **antes de qualquer operação**, exceto Compras, que conserva gestão compartilhada. A suspeita inicial de restauração/exclusão sem autoria foi descartada após nova leitura; não houve correção desnecessária.
- Restauração remove `deleted_at`/`deleted_by` e registra atividade. Exclusão permanente exige item já na lixeira; confirmação explícita existe na interface, não é mecanismo de autorização.
- Tabelas soft-deleted são filtradas nas políticas de leitura normais. Testar efeitos nas referências filhas ainda é necessário; aportes são uma exceção apontada acima.
- Histórico de atividade não aceita gravação direta pelo cliente; `log_activity` tem execução revogada a clientes. Auditoria registra metadados curtos, não conteúdo completo.
- Sinais de sincronização usam workspace e payload mínimo, com associação protegida por RLS; não há canal global de DELETE adotado pela implementação atual.
- Bucket `avatars` é privado, com limite de 2 MB. Uploads da interface validam JPEG/PNG/WebP; URLs assinadas são temporárias e dependem das políticas do objeto. O bucket não declara allowlist MIME: validação do cliente sozinha não é uma fronteira confiável contra uploads adulterados.
- Agente deriva workspace da conversa acessível pela sessão, usa ferramentas de leitura com RLS e gera propostas em vez de executar gravações. Confirmação reutiliza mutações atuais. Histórico recebido e resultados textuais continuam entradas não confiáveis; não há promessa de resistência completa a prompt injection.
- Inspeção não encontrou segredo privado marcado `VITE_` nos caminhos pesquisados. Segredos de IA aparecem em módulos/handlers de servidor. Não houve leitura de `.env`, exposição de credenciais ou inspeção de bundle publicado. Exceções completas registradas no console do agente merecem redução a códigos seguros.
- URLs de capa são renderizadas no navegador; não foi encontrado fetch servidor arbitrário desses endereços nos caminhos revisados. Isso não demonstra ausência de SSRF em todo o projeto.

## Testes e resultados

| Verificação | Resultado |
| --- | --- |
| `bunx vitest run` | 9 arquivos, 29 testes passaram: Contextos, parser de orçamento, exportação, datas/parcelas/faturas, Dinheiro Livre, acertos, ocorrências de rotinas e permissões/registro existente de plugins. |
| Lint direcionado aos nove arquivos alterados de código/teste | Passou, saída 0. |
| `bun run lint` | Falhou: 3.118 erros, 47 avisos; dívida geral registrada acima. |
| Verificação automática da prévia | Última entrada observada: `build OK`, 17/10/2026 20:42:20 UTC. Não executado build ou typecheck manual; a plataforma realiza essas verificações. |
| Navegação Playwright | `/auth` renderizou; sem overflow em 320, 390, 768, 1280 e 1920 px; screenshots conferidas em 320/1920; zero erros de página. |
| Proteção sem sessão | `/contextos` terminou em `/auth`; POST `/api/agent` retornou 401. |
| PWA pública | `/manifest.webmanifest` e `/icon-192.png` retornaram 200. Instalação e modo offline não testados. |
| Scanner básico de segurança | Sem achados nesse scanner; não cobre os achados manuais acima. |
| Auditoria de dependências | `bun audit` retornou HTTP 404; vulnerabilidades de dependências não verificadas. |

**Não testados de ponta a ponta:** Dashboard, Financeiro completo/cartões/pagamentos, Agenda, Tarefas, Metas, Contextos, Nós, Notas, Compras, Rotinas, Esporte, Meu Dia, Life AI global e Control Center autenticados. Foram inspecionados caminhos e regras relevantes, mas redirecionamento para login não foi contado como smoke-test desses módulos. Temas e navegação mobile interna também pendentes.

Nenhum registro temporário foi criado nesta revisão; não há limpeza de dados pendente.

## Arquivos e migrations

Correção de Contextos já presente ao início desta revisão: `drizzle/migrations/0011_fix_context_creation_audit.sql`, `src/features/contexts/queries.ts`, `src/features/contexts/validation.ts`, `src/features/contexts/validation.test.ts` e tratamento seguro do modal.

Alterações desta revisão:

- `src/features/contexts/budget.ts` e `budget.test.ts`.
- `src/components/quick/context-dialog.tsx` — parser estrito.
- `src/features/export/export.ts` e `export.test.ts`.
- `src/features/finance/calc.test.ts` e `safe-to-spend.test.ts`.
- `src/features/nos/settlements.test.ts`.
- `src/features/routines/queries.test.ts`.
- `drizzle/migrations/0013_restrict_shared_profile_avatar_reads.sql`, journal/snapshot gerenciados pelo migrador.
- `AGENTS.md`, `roadmap.md`, este relatório e memória de preservação/segurança do projeto.

`0013` foi aplicada com sucesso pelo sistema de migrations e a política hospedada foi relida. Não altera registros nem estrutura destrutivamente. `0012` pertence à implementação anterior de plugins, não a esta revisão. Nenhum novo plugin, conector, conta externa ou envio foi implementado.

## Próximos passos prioritários

1. Entrar na prévia com a conta apropriada para liberar validação autenticada. Confirmar criação/edição de Contextos, campos opcionais em branco, recarga, segundo workspace e todos os módulos listados.
2. Aprovar revisão ampla do histórico do Life AI: mensagens tipadas, histórico canônico sujeito a RLS, proteção contra falsificação de resultados, limites de entrada e quota por usuário. Confirmar estratégia para não quebrar threads compartilhadas.
3. Aprovar ajuste de visibilidade de aportes para seguir a meta pai, incluindo metas privadas/excluídas e restauração, preservando a gestão compartilhada pretendida.
4. Validar imagens entre dois usuários/workspaces, reforçar MIME no storage e revisar logs de erros.
5. Planejar transações financeiras, integridade de cartão em UPDATE, teste concorrente e auditoria de dependências; tratar lint geral em trabalho separado.

Não foi feito deploy/publish. Migrations aplicadas são mudanças no banco hospedado; não foram descritas como alteração apenas local. As regras compartilhadas existentes de João e Renifer não foram modificadas.