# Plano — Módulo "Casamento" (isolado dentro do Life OS)

Área independente com navegação, dashboard, dados, categorias, status e configurações próprios. Mesmo login e mesmo workspace do casal. Nada implementado ainda.

## 1. Princípio de isolamento
- Fonte de verdade única: tabelas `wedding_*`. Nenhum registro é criado, lido ou somado a partir de Financeiro, Metas, Tarefas, Agenda, Notas, Compras ou Contextos.
- Nenhum lançamento financeiro geral em segundo plano; nenhum item do Casamento aparece em outras telas, contagens ou buscas gerais.
- Integração futura (importar/exportar/vincular) só por ação explícita do usuário, com prévia e sem duplicação — fora do escopo inicial.

Reutilizado apenas como infraestrutura transversal: autenticação, `workspace_members` / `user_is_workspace_member` / `workspace_can`, padrão de FK composta para membro real, design system e componentes, upload de imagens com caminho por workspace, sync em tempo real (`workspace_sync_events`), auditoria mínima (`workspace_activity`), lixeira (`trash_record`/`list_trash` estendidos) e preferências de menu.

## 2. Navegação e páginas
Item de menu "Casamento" com submenu (mesmo padrão do submenu da Faculdade):
```text
/casamento                 Visão geral do casamento (dashboard consolidado)
/casamento/casa            Nossa Casa / Enxoval   (escopo funcional inicial)
  abas: Painel | Inventário | Economia | Despesas | Preparativos | Fornecedores
/casamento/cerimonia       placeholder "Em breve"
/casamento/festa           placeholder "Em breve"
/casamento/lua-de-mel      placeholder "Em breve"
/casamento/planejamento    placeholder "Em breve"
/casamento/configuracoes   dados do plano, categorias, status, responsáveis
```
- **Painel Nossa Casa**: custo estimado (preço-meta × qtd), meta de economia, acumulado, gasto, saldo restante, progresso por prioridade e por cômodo, alerta "X itens sem preço" (totais parciais).
- **Inventário**: por cômodo/categoria, filtros (cômodo, prioridade, status, responsável, faixa), edição mobile-first, "Marcar comprado" que gera despesa interna do módulo.
- **Economia**: metas mensais a partir de jan/2027, aportes por pessoa, projetado × realizado.
- **Despesas**: gastos do módulo (compras de itens e custos de mudança/instalação).
- **Preparativos**: tarefas, decisões, prazos, responsáveis, notas.
- **Fornecedores**: lojas/prestadores com contato e links.

## 3. Entidades próprias (migration aditiva 0020)
```text
wedding_plans          1 por workspace: wedding_date?, move_in_date?, total_budget?,
                       housing ('rent'), bedrooms (2), standard ('intermediate'),
                       savings_start (2027-01-01), notes?          [premissas declaradas, editáveis]
wedding_areas          subáreas: house | ceremony | party | honeymoon | planning (enabled flag)
wedding_rooms          cômodos/categorias editáveis (area_id, name, sort_order)
wedding_items          room_id, name, quantity, priority P1|P2|P3,
                       price_low?, price_target?, price_high?, price_actual?,
                       status to_research|researched|planned|bought,
                       responsible_user_id?, supplier_id?, links text[], notes?,
                       expense_id? -> wedding_expenses
wedding_savings_goals  area_id?, month (date), target_amount
wedding_contributions  user_id (quem aportou), amount, date, note?
wedding_expenses       area_id, item_id?, supplier_id?, amount, date,
                       paid_by_user_id, split ('equal'|'payer'|custom), note?
wedding_tasks          area_id, title, kind task|decision, due_date?, status,
                       responsible_user_id?, notes?
wedding_notes          area_id, title, content
wedding_suppliers      name, category?, contact?, url?, notes?
```
Todas: `workspace_id`, `created_by`, timestamps, `deleted_at/deleted_by` (lixeira) onde fizer sentido. Valores monetários `numeric`, sempre nulos até o casal preencher.

## 4. Controle de acesso
- RLS em todas: SELECT/UPDATE/DELETE por membro do workspace; INSERT exige membro e `created_by = auth.uid()`; SELECT inclui `deleted_at IS NULL`.
- FKs compostas `(workspace_id, *_user_id)` → `workspace_members` para responsável, aportante e pagador; FKs compostas `(workspace_id, id)` entre item/cômodo/despesa/fornecedor para impedir vínculo entre workspaces.
- Grants só `authenticated` e `service_role`; sem anon.
- Módulo disponível apenas em workspaces não-demo (checagem server-side via trigger/RPC); workspaces pessoais mostram estado "disponível no espaço do casal".
- Life AI (fase posterior): ferramenta de leitura `wedding` via caller RLS e propostas com confirmação e read-back; registry fechado de plugins.

## 5. Inventário inicial
- Botão "Criar inventário sugerido" (ação explícita, com prévia): cômodos — quarto principal, segundo quarto multifuncional, sala, jantar, cozinha/eletrodomésticos/utensílios/louças, banheiro, lavanderia, limpeza/manutenção, cama/mesa/banho, tecnologia, segurança, organização, áreas externas, instalação/mudança — com quantidades e prioridades sugeridas e **preços vazios**.
- Importação/exportação CSV própria do módulo, com prévia e neutralização de fórmulas.

## 6. Riscos e migrações
- Apenas aditiva; nenhuma alteração em tabelas ou dados existentes.
- Lixeira e sync: estender `trash_record`/`list_trash` e triggers de sync às novas tabelas (alteração de função, sem mudar dados).
- Totais com preços faltantes → sempre exibidos como parciais.
- Duplicidade se o casal lançar o mesmo gasto também no Financeiro geral → aviso informativo; integração explícita fica para depois.
- Testes: contrato SQL (RLS, FKs, sem seed de preços), cálculos do painel, rejeição de referências de outro workspace e de usuário não-membro, isolamento (nada aparece nas consultas gerais).

## 7. Decisões pendentes com o casal
1. Despesas divididas 50/50 por padrão ou por quem pagou?
2. Meta de economia única para a casa ou por subárea desde já?
3. Metas mensais fixas ou valor variável por mês?
4. Fornecedores já no início ou depois?
5. Faixas econômica/premium preenchidas manualmente ou só preço-meta?
6. Quem pode excluir itens/despesas: ambos (padrão) ou com confirmação do outro?
7. Ordem no menu e se Casamento deve ser a tela inicial de alguém.
