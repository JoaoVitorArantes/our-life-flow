# Plano — Casamento como área principal do Life OS

Nada será implementado antes da aprovação. Tudo continua isolado em tabelas `wedding_*`, sem lançamentos em Financeiro, Metas, Agenda, Tarefas, Notas ou Compras.

## 1. Auditoria do que existe hoje

**Telas:** `/casamento` (visão geral), `/casamento/casa` (abas Painel, Inventário, Economia, Despesas, Preparativos, Fornecedores), `/casamento/configuracoes`, `/casamento/$area` (Cerimônia, Festa, Lua de Mel, Planejamento: "Em breve").

**Dados (contagens apenas, sem ler conteúdo):**
- Espaço do casal (2 membros): 15 cômodos, 80 itens, 0 despesas. Os itens vieram do botão "Criar inventário sugerido": são dados reais do casal, não demonstração. Serão preservados integralmente.
- Um espaço da pessoa de teste usada na verificação anterior ainda tem 15 cômodos, 80 itens e 2 despesas. Ele não aparece para o casal. Proponho apagar só esse espaço de teste, depois de comprovar a identidade dele (1 membro, que é a conta de teste).

**Problemas encontrados:**
- No celular, o nome do item fica numa linha com `truncate` ao lado de badges e botão sem largura mínima reservada. O nome é cortado ou some. O nome do cômodo no painel também é truncado.
- Os cômodos não são clicáveis. Não existe página de detalhe do cômodo nem do item.
- Prioridade (P1/P2/P3), status (4 valores) e área estão fixos no banco com CHECK. Não dá para personalizar.
- Não há duplicar, arquivar, restaurar nem reordenar. Excluir usa `confirm()` do navegador e apaga de vez.
- Não há imagens, descrição, lixeira, papéis ou auditoria.
- O visual é o do Life OS escuro, sem identidade própria.
- A navegação entre áreas é uma fileira de pílulas com rolagem horizontal e o menu tem só 2 subitens.
- Não existem convidados, portal, RSVP, check-in nem presentes.

## 2. Identidade visual do Casamento (só dentro do módulo)
- Tema aplicado por um wrapper `.wedding-theme` que redefine tokens semânticos (`--background`, `--surface`, `--primary`, etc.) só nas rotas `/casamento/*` e no portal. O resto do Life OS não muda.
- Paleta clara e quente: marfim (fundo), champagne (superfícies), blush/rosé (primária), lavanda (secundária), ameixa (texto forte e foco), detalhes dourados finos (divisores, ícones). Contraste AA verificado em todos os pares texto/fundo.
- Tipografia: serifada elegante para títulos (ex.: Cormorant Garamond ou Fraunces) e sans legível para o corpo (ex.: Manrope), carregadas por `<link>` no root.
- Detalhes: ornamentos SVG delicados (ramos, monograma "J & R"), cards com borda fina dourada, sombras suaves, capa com foto do casal opcional e gradiente translúcido.
- Variações seguras escolhidas nas Configurações: "Champagne & Blush" (padrão), "Lavanda & Ameixa", "Marfim & Dourado". Não há cores livres, para não perder legibilidade.

## 3. Telas e navegação

```text
Painel do casal (autenticado)
/casamento                     Dashboard
/casamento/casa                Nossa Casa: visão por cômodos (cards clicáveis) + lista geral
/casamento/casa/$roomId        Detalhe do cômodo: resumo, progresso, itens
/casamento/casa/item/$itemId   Detalhe/edição do item
/casamento/convidados          Lista, grupos/famílias, convites
/casamento/convidados/$guestId Detalhe do convidado + histórico
/casamento/checkin             Modo check-in (busca/código/QR)
/casamento/presentes           Lista de presentes e contribuições recebidas
/casamento/orcamento           Economia, metas mensais, despesas
/casamento/preparativos        Tarefas, decisões, prazos
/casamento/fornecedores
/casamento/cerimonia, /festa   Informações do evento publicadas no portal
/casamento/configuracoes       Casal, capa, mensagem, tema, prioridades, status, papéis, lixeira

Portal do convidado (público, sem acesso ao Life OS)
/convite/$code                 Entrada pelo link/código individual
/convite                       Página do evento, RSVP, presentes, mensagem, status do check-in
```

**Mobile-first:**
- No celular, uma barra inferior própria do módulo com 5 atalhos (Início, Casa, Convidados, Presentes, Mais). No desktop, um menu lateral do módulo. O submenu "Casamento" do Life OS ganha todas as áreas.
- Listas em cards empilhados. Nome em até 2 linhas com `line-clamp-2` e `min-w-0`. Badges e ações vão para a linha de baixo. Toque de no mínimo 44px.
- Tabela só no desktop (≥ lg), com nome sempre visível. Formulários em folha inferior (`Drawer`) no celular e em diálogo no desktop.
- Testes de layout em 320, 375, 768, 1024 e 1440px, sem rolagem horizontal.

**Nossa Casa:**
- Grade de cômodos com nome, contagem comprados/total, valor estimado e barra de progresso. Clicar abre o detalhe.
- Lista geral com busca, filtros (cômodo, prioridade, status, responsável, faixa de preço, "sem preço"), ordenação (nome, prioridade, preço, status, ordem manual) e alternância Cômodos/Lista.
- Ações do item: editar, duplicar, mover de cômodo, marcar comprado, arquivar (vai para a lixeira) e restaurar. A confirmação usa `AlertDialog`.
- Cômodos: criar, renomear, reordenar (arrastar no desktop, setas no celular), desativar, escolher ícone e cor.
- Imagens dos itens em armazenamento privado por espaço.

**Dashboard:**
- Progresso geral, enxoval (comprados/total, itens sem preço), orçamento (meta, guardado, gasto, falta), convidados (confirmados, pendentes, recusados, pessoas esperadas), presentes (recebidos, pendentes de confirmação) e próximas 5 tarefas.
- Cada número mostra "—" ou "não informado" quando não há dado. A contagem regressiva só aparece se houver data.

## 4. Modelo de dados (migrations aditivas)

**Fase 1 — personalização e lixeira**
```text
wedding_priorities   id, workspace_id, label, description, color, sort_order, archived_at
wedding_statuses     id, workspace_id, label, color, counts_as_bought bool, sort_order, archived_at
wedding_rooms        + icon, color, description, archived_at
wedding_items        + priority_id, status_id, description, image_path, sort_order,
                       archived_at, archived_by
wedding_plans        + couple_names, message, cover_path, theme
```
- Backfill: para cada espaço com itens, cria as prioridades P1/P2/P3 e os 4 status atuais e preenche `priority_id`/`status_id` a partir das colunas de texto.
- As colunas antigas `priority`/`status` ficam marcadas DEPRECATED, sem DROP. A troca do CHECK é feita só depois que o código parar de usá-las.
- A lixeira do módulo é feita com `archived_at`. Restaurar limpa o campo. A exclusão definitiva só acontece a partir da lixeira.

**Fase 2 — papéis, convidados, portal e check-in**
```text
wedding_roles          workspace_id, user_id, role (admin|organizer)  -- membros do casal = admin
wedding_households     id, workspace_id, name, notes_internal, max_seats, invite_status
wedding_guests         id, workspace_id, household_id, name, email?, phone?, category,
                       is_child, dietary?, accessibility?, notes_internal, archived_at
wedding_invitations    id, workspace_id, household_id, code_hash, code_hint(4),
                       expires_at, revoked_at, last_used_at
wedding_rsvps          household_id UNIQUE, status, seats_confirmed, updated_by_guest_at
wedding_rsvp_guests    rsvp_id, guest_id, attending, dietary?, accessibility?
wedding_checkins       id, workspace_id, guest_id, checked_at, operator_id,
                       voided_at, voided_by, void_reason  -- só 1 ativo por convidado
wedding_guest_messages id, workspace_id, household_id, body, created_at, read_at
wedding_public_content workspace_id, section, title, body, location, starts_at?, published bool
wedding_audit          id, workspace_id, actor (user id ou 'guest:<household>'), action,
                       entity, created_at  -- sem dados pessoais
```

**Fase 3 — presentes e contribuições**
```text
wedding_registry_items id, workspace_id, kind (item|fund|quota), title, description,
                       image_path, suggested_amount?, quota_amount?, quota_limit?,
                       allow_anonymous, status, sort_order, archived_at
wedding_gift_pledges   id, workspace_id, registry_item_id, household_id, quotas, amount?,
                       message?, display_name_choice (name|anonymous),
                       state (pending|confirmed|cancelled|expired), confirmed_by, confirmed_at
wedding_payment_info   workspace_id, pix_key_display?, instructions?  -- só exibição
```

## 5. Autorização e RLS
- **Casal/admin** (membros do espaço com papel admin): acesso total às tabelas `wedding_*` do próprio espaço. Usa `user_is_workspace_member` + `wedding_has_role(workspace, 'admin')`, uma função SECURITY DEFINER.
- **Organizador:** é membro convidado com papel `organizer`. Por RLS só lê nome/grupo/status do convidado e o check-in, e só grava check-in. Contatos, notas internas e orçamento ficam numa visão restrita para ele. Os dados sensíveis do convidado vão para uma tabela separada `wedding_guest_private` (email, phone, notes_internal), legível só por admin.
- **Convidado:** não tem conta no Life OS e não tem acesso direto às tabelas (sem grant para anon).
  - Ele entra pelo portal com um código individual de 128 bits aleatórios, mostrado em link e QR. O banco guarda só o hash SHA-256 do código, com validade e possibilidade de revogação.
  - O servidor valida o hash com tempo constante e emite um cookie de sessão de convite (HttpOnly, assinado, curto, vinculado ao `household_id`).
  - Cada operação do portal é uma função de servidor que recebe só o household da sessão. Nunca aceita `household_id`, `guest_id` ou quantidades vindas do cliente sem conferir.
  - Contra enumeração: limite de tentativas por IP/código, resposta genérica de "convite inválido", códigos não sequenciais e nenhuma busca por nome no portal.
  - Acompanhantes: `seats_confirmed ≤ max_seats` é checado no servidor e por trigger. RSVP é um registro único por household, com upsert e marca de tempo. Mensagens têm tamanho máximo e limite de frequência.
- **Check-in:** índice único parcial (`guest_id` onde `voided_at IS NULL`) impede duplicidade. A correção anula o anterior com motivo e auditoria.
- **Presentes:** uma reserva roda numa transação via RPC SECURITY DEFINER com `SELECT ... FOR UPDATE` no item. Ela conta as cotas ativas (pending + confirmed) e recusa se passar do limite. Reservas pendentes expiram após X dias (ver decisões).
  - "Pago" só é marcado por admin ao conciliar. No portal aparece "reserva/intenção" até a confirmação.
- **Privacidade:** coletar só o necessário. Restrições alimentares e de acessibilidade são opcionais. Os dados de convidados podem ser apagados em massa após o evento (retenção configurável). Logs não guardam contatos.
- **Pagamento:** a Fase 3 entrega só Pix/transferência por instruções e conciliação manual. Checkout de um provedor (Stripe/Mercado Pago) é uma fase separada que exige autorização e configuração específicas. Dados de cartão nunca são guardados.

## 6. Fases e critérios de aceite

**Fase 1 — Inventário, responsividade e identidade (primeira entrega)**
- Tema do Casamento, navegação do módulo e dashboard novo.
- Nossa Casa com cômodos clicáveis, detalhe do cômodo e do item, CRUD completo, duplicar, arquivar/restaurar, prioridades e status configuráveis, imagens e reordenação.
- Aceite:
  - Os 80 itens e os 15 cômodos do casal continuam com as mesmas contagens antes e depois.
  - Nenhum nome é cortado a 320px.
  - Nada rola na horizontal em 320/375/768/1024/1440px.
  - Contraste AA e foco visível.
  - Fluxo testado no navegador: criar, editar, duplicar, arquivar, restaurar e renomear prioridade.
  - Testes de backfill e de RLS por espaço.

**Fase 2 — Convidados, portal, RSVP e check-in**
- Aceite:
  - Um convidado com código A não lê dados do household B.
  - Um código revogado ou expirado é recusado.
  - Acompanhantes acima do limite são recusados.
  - O segundo check-in do mesmo convidado é recusado.
  - O organizador não lê contatos nem notas.
  - Tentativas em massa são bloqueadas.
  - Portal testado a 320px.

**Fase 3 — Presentes e contribuições (Pix manual)**
- Aceite:
  - Duas reservas simultâneas da última cota: só uma passa.
  - Pendente vira expirado ou cancelado corretamente.
  - O anonimato é respeitado no painel e no portal.
  - Nada aparece no Financeiro geral.

**Fase 4 (opcional, com autorização)** — checkout de pagamento por um provedor.

Em todas as fases: testes automatizados das regras, verificação no navegador com uma pessoa de teste em espaço próprio, sem tocar nos dados do casal, e nada é publicado.

## 7. Decisões que precisam do casal
1. Nomes como devem aparecer (ex.: "João & Renifer") e se querem monograma.
2. Tema padrão: Champagne & Blush, Lavanda & Ameixa ou Marfim & Dourado.
3. Convite por família/grupo (um código por casa) ou por pessoa?
4. Portal pede só o código ou também uma confirmação extra (ex.: últimos dígitos do telefone)?
5. Haverá organizadores/equipe com acesso ao check-in? Quem?
6. Presentes: só Pix/transferência manual no início? Qual chave Pix exibir? Elas mesmas informam depois, não vamos inventar.
7. Prazo para reservas pendentes expirarem (ex.: 7 dias).
8. Por quanto tempo guardar dados dos convidados após o evento.
9. Posso apagar o espaço da pessoa de teste que sobrou da verificação anterior?
