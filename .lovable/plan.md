# Plano — Módulo "Casamento" (Nossa Casa / Enxoval)

Seção dentro do Life OS, compartilhada no workspace do casal. Nada implementado ainda.

## 1. O que já existe e será reutilizado
- **Workspace + RLS**: `workspace_members`, `user_is_workspace_member`, `workspace_can`, FKs compostas para membro real (padrão da Faculdade 0018/0019).
- **Contextos** (`contexts`, tipo `COUPLE`/`PROJECT`, `budget_amount`): o Casamento será um contexto âncora; tarefas, notas, eventos, metas e transações já têm `context_id`.
- **Metas** (`goals` + `goal_contributions` com `user_id`, `movement_type` CONTRIBUTION/WITHDRAWAL): meta de economia e aportes por pessoa — sem tabela nova de poupança.
- **Financeiro** (`transactions`, `transaction_payers`, `transaction_splits`, `settlements`): compras viram transações reais vinculadas ao item; divisão segue as regras de compartilhamento existentes.
- **Compras** (`purchases`, com `transaction_id`, `found_price`, `purchase_url`): referência de padrão (status, link, conversão em transação).
- **Tarefas/Agenda/Notas** com `context_id`: Preparativos e cronograma.
- **Lixeira** (`trash_record`/`list_trash`), **sync em tempo real** (`workspace_sync_events`), **auditoria** (`workspace_activity`), **preferências de menu** (`user_preferences`), **registry de plugins/Life AI** com confirmação.
- **Design**: tokens atuais (#0B0D10 / #12151A / #7C5CFC), componentes shadcn, padrão de cabeçalho premium da Faculdade.

## 2. Páginas / abas (rota `/casamento`, item de menu próprio)
1. **Visão geral** — custo estimado (soma preço-meta × qtd), meta de economia, acumulado (da meta), gasto (transações vinculadas), saldo restante, progresso por prioridade P1/P2/P3 e por cômodo; avisos de "itens sem preço" (total marcado como parcial).
2. **Nossa Casa / Enxoval** — inventário por cômodo/categoria, filtros (cômodo, prioridade, status, responsável), edição em linha mobile-first, ação "Registrar compra".
3. **Planejamento financeiro** — meta mensal a partir de jan/2027, aportes por pessoa (goal_contributions), projeção vs. realizado.
4. **Preparativos** — tarefas, decisões, prazos e responsáveis (tasks/events/notes do contexto).
5. **Configurações do plano** — data do casamento, data de mudança, orçamento total, cidade, tipo de imóvel: todos opcionais, vazios = "não informado".

## 3. Entidades novas (migration aditiva 0020)
```text
wedding_plans (1 por workspace)
  workspace_id PK/FK, context_id -> contexts, goal_id -> goals,
  wedding_date?, move_in_date?, total_budget?, savings_start (default null),
  monthly_savings_target?, housing_type?, bedrooms?, notes?, created_by

home_rooms            (cômodos/categorias; editáveis, ordem)
  id, workspace_id, name, sort_order, created_by

home_items
  id, workspace_id, room_id, name, quantity, priority (P1|P2|P3),
  price_low?, price_target?, price_high?, price_actual?,
  status (to_research|researched|planned|bought),
  responsible_user_id? -> workspace_members(workspace_id,user_id),
  notes?, links text[], transaction_id? -> transactions,
  deleted_at/deleted_by (lixeira), created_by, timestamps
```
- Decisões do cronograma = `tasks` com `context_id` (status/prazo/responsável); sem tabela nova inicialmente.
- Preços em `numeric`, nunca preenchidos por seed.

## 4. Integração sem duplicar lançamentos
- "Registrar compra" cria **uma** transação EXPENSE via mutação existente (com payers/splits), grava `home_items.transaction_id` e `status=bought`; `price_actual` pode ser lido da transação. Gasto do dashboard = soma das transações vinculadas (fonte única).
- Aportes = `goal_contributions` da meta do plano; acumulado = `goals.current_amount`.
- Tudo com `context_id` do contexto Casamento, aparecendo também em Financeiro/Metas/Agenda sem cópia.

## 5. Controle de acesso
- RLS: SELECT/UPDATE/DELETE por `user_is_workspace_member`; INSERT exige membro + `created_by = auth.uid()`; responsável via FK composta para membro real.
- Trigger valida que room/item/transação/contexto/meta pertencem ao mesmo workspace (`validate_workspace_references`).
- Bloqueio em workspaces `is_demo` e em workspaces sem 2 membros (opcional, a confirmar); grants para authenticated/service_role, sem anon.
- Soft-delete incluído em `trash_record`/`list_trash`; triggers de sync e auditoria mínima.
- Life AI: ferramenta de leitura `wedding` via caller RLS; propostas (criar item, registrar compra/aporte) apenas com confirmação e read-back.

## 6. Inventário inicial
- Botão "Criar inventário sugerido" (ação explícita do usuário, nunca automático): ~14 cômodos e itens com quantidade e prioridade sugeridas, **todos os preços vazios**. Lista mantida em código, revisável antes de gravar (prévia).
- Importação/exportação CSV reaproveitando o padrão de prévia e neutralização de fórmulas.

## 7. Riscos e migrações
- Somente aditiva; nenhuma alteração em dados existentes.
- Risco de gasto duplicado se o usuário também lançar a compra no Financeiro manualmente → oferecer "vincular transação existente".
- Totais com preços faltantes podem enganar → sempre exibir "X itens sem preço".
- Divisão de compras depende das regras atuais de splits; testar contrato.
- Testes: contrato SQL (RLS/FKs, sem seed de preços), cálculo do dashboard, fluxo compra→transação única, rejeição de referências de outro workspace.

## 8. Perguntas para o casal
1. Contexto existente ou novo contexto "Casamento"?
2. Uma meta única de economia ou metas separadas (enxoval, cerimônia, mudança)?
3. Escopo: só a casa agora, ou já prever cerimônia/festa/lua de mel como submódulos futuros?
4. Aportes devem sair de uma conta específica (ex.: poupança) como transferência no Financeiro?
5. Compras padrão divididas 50/50 ou por quem pagou?
6. Ordem do menu: item solto "Casamento" ou dentro de Contextos?
7. Faixas econômica/premium: valores manuais ou só preço-meta intermediário obrigatório?
