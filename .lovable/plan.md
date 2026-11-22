# Casamento — diagnóstico de publicação e Fase 3 (Presentes)

## 1. Diagnóstico de publicação (verificado agora)

- Último commit do branch: `44b1f35` (16:42 UTC, correção da lixeira).
- Última publicação: 16:43:46 UTC, ou seja, **depois** desse commit. O sistema diz que não há mudanças sem publicar.
- Conclusão: **o site de produção já roda o branch atual inteiro**. Isso inclui:
  - Fase 1 do Casamento (b4c4640).
  - Fase 2 (convidados, convites, portal `/convite`, RSVP, check-in: 0950888 / f3eab1b / bfc4539). Antes eu tinha relatado como "não publicada", mas a publicação de 16:43 incluiu essa fase.
  - Notas e recibos (78b8a79).
  - Correção da lixeira (44b1f35).
  - A Faculdade compartilhada (migrations 0018/0019) já estava em commits anteriores e também está no ar.
- As mudanças no banco (migrations 0020–0031) valem para o preview e para a produção desde o momento em que foram aplicadas, porque os dois usam o mesmo backend. Não dependem de publicação.
- Segurança: última verificação sem alertas pendentes (o da lixeira foi corrigido). A verificação do banco é das 16:30 e está marcada como desatualizada. Antes da próxima publicação, recomendo rodar uma nova.
- Build: não há registro de build disponível nesta sessão. Os últimos testes conhecidos foram: tipos OK e 163 testes aprovados (antes da correção da lixeira). A lixeira ainda não foi testada na tela.
- Riscos da Fase 2 já publicada:
  - Até agora existem 0 convidados e 0 convites no espaço real, então nenhum dado de convidado foi exposto.
  - O portal público já responde em produção. Hoje ele só mostra um convite a quem tiver um código válido.
- Publicar de novo agora não levaria nada novo ao ar.

## 2. Fase 3 — Presentes (escopo final com as decisões confirmadas)

Decisões confirmadas:
- Tipos: `physical`, `fund` e `quota`.
- Anonimato: `couple`.
- Expiração: 15 dias.
- Confirmação: manual pelo casal.
- Pix: só informativo e vazio até o casal preencher.
- Portal de presentes desativado até o casal ativar.
- Teto por reserva: R$ 50.000,00.
- O convidado não edita reservas: só cancela a própria pendente e, se quiser, cria outra.
- O portal não mostra progresso de fundos (nem arrecadado, meta, percentual ou barra).

### 2.1 Escopo funcional

**Painel do casal (`/casamento/presentes`, novo item no submenu Casamento)**
- **Lista de presentes:** cards responsivos com filtros por tipo, estado (disponível/esgotado/oculto/arquivado) e busca.
- **Criar e editar presente:**
  - Campos: tipo, título, descrição, imagem (bucket privado `wedding`), link externo opcional, ordem e visível no portal.
  - `physical`: quantidade desejada.
  - `quota`: valor da cota e total de cotas.
  - `fund`: valor sugerido opcional e meta opcional **visível só para o casal**, sem limite de reservas.
  - Arquivar e restaurar.
- **Detalhe do presente:** disponibilidade e a lista de reservas/intenções. O casal vê o convite de origem (nome do convite), a quantidade ou valor, a mensagem e o estado.
- **Ações por reserva:**
  - Confirmar recebimento.
  - Cancelar (com motivo).
  - Reabrir uma cancelada ou expirada, se ainda houver disponibilidade.
- **Configurações de presentes:**
  - Ativar a seção no portal.
  - Tipo da chave Pix, chave, nome do recebedor e instruções (Pix e entrega de itens físicos).
  - Tudo vazio por padrão. Se o Pix estiver vazio, o portal não mostra Pix.
- **Painel inicial do Casamento:** cards "Recebidos" e "Aguardando confirmação", com dados reais.

**Portal do convidado (`/convite/$token`)**
- A seção "Presentes" só aparece quando o casal ativar.
- **Lista:** presentes visíveis e não arquivados, só com a disponibilidade e a regra de reserva:
  - `physical`: "X de N disponíveis" ou "Esgotado".
  - `quota`: valor da cota e "X de N cotas disponíveis" ou "Esgotado".
  - `fund`: apenas "Disponível" e o valor sugerido, se houver. Nunca arrecadado, meta, percentual ou progresso.
  - Nunca mostra quem reservou.
- **Reservar:**
  - `physical`: quantidade, até o que está disponível.
  - `quota`: número de cotas.
  - `fund`: valor que pretende enviar.
  - Mensagem curta opcional.
- **Depois de reservar:** mostra estado "Aguardando confirmação do casal" com prazo, as instruções e o Pix, se cadastrados.
- **Minhas reservas:** só as do próprio convite, com estado. Sem edição: o convidado pode cancelar a própria pendente e, se quiser, criar outra. Não existe função pública de edição.

### 2.2 Modelo de dados e migrations (aditivas)

```text
wedding_gifts
  id, workspace_id, kind (physical|fund|quota), title, description, image_path, external_url,
  quantity_total (physical), quota_amount + quota_total (quota), suggested_amount, goal_amount (fund),
  is_visible, sort_order, archived_at, created_by, created_at, updated_at
  CHECKs por kind; valores > 0; FK composta (workspace_id, id) para pledges

wedding_gift_pledges
  id, workspace_id, gift_id, invitation_id, units (physical/quota), amount (fund ou units*cota),
  message (≤ 500), state (pending|confirmed|cancelled|expired), expires_at (created + 15 dias),
  confirmed_by/at, cancelled_by_kind (guest|couple|system), cancel_reason, created_at, updated_at
  FKs compostas por workspace para gift e invitation

wedding_gift_settings (1 linha por workspace)
  portal_enabled (default false), pending_days (default 15), anonymity (default 'couple'),
  pix_key_type, pix_key, pix_receiver_name, instructions, delivery_instructions (todos nulos)
```

- **Migration 0032:** tabelas, grants (authenticated + service_role, nada para anon), RLS por membro, FKs compostas, triggers de `updated_at`, bloqueio em workspace demo e eventos de sincronização.
- **Migration 0033:**
  - Funções do painel: `wedding_gift_confirm`, `wedding_gift_cancel`, `wedding_gift_reopen`, que checam se quem chama é membro.
  - Funções do portal: `wedding_portal_gifts`, `wedding_portal_pledge`, `wedding_portal_pledge_cancel`, todas com o mesmo código/token, limite de tentativas e `search_path` fixo usados na Fase 2.
- **Histórico:** todo evento entra em `wedding_guest_audit`, só com ação, tipo, id e ator.

### 2.3 Regras de reserva

- **Disponibilidade:** total menos as unidades em reservas pendentes ainda no prazo e confirmadas. `fund` não tem limite.
- **Concorrência:** a reserva roda dentro de uma função que trava o presente (`SELECT … FOR UPDATE`), recalcula a disponibilidade e recusa se faltar. Com isso, a última cota só pode ser pega uma vez.
- **Expiração em 15 dias:**
  - `expires_at` é gravado na criação.
  - Uma reserva pendente vencida deixa de contar na hora (o cálculo já filtra pelo prazo).
  - Ela é marcada como `expired` quando o portal ou o painel é lido ou quando há uma nova reserva. Não há tarefa agendada.
- **Cancelamento:**
  - O convidado só cancela as próprias pendentes. O casal cancela qualquer uma, com motivo.
  - Cancelar libera a disponibilidade e fica registrado no histórico.
- **Confirmação:**
  - Só o casal marca uma pendente como `confirmed`.
  - Uma reserva expirada só pode ser confirmada depois de ser reaberta, e reabrir revalida a disponibilidade com trava.
  - O valor confirmado de `fund` pode ser ajustado pelo casal.
- **Limites:**
  - Até 10 reservas por convite por hora.
  - Até 100 unidades por reserva.
  - Teto de R$ 50.000,00 por reserva: `amount` em `fund` e unidades × valor da cota em `quota`, validado na função e por CHECK no banco.
  - Mensagens com até 500 caracteres, sem HTML.
- O Pix nunca é validado nem conciliado.

### 2.4 Privacidade, RLS e isolamento

- O casal (membros do espaço) lê e escreve só nas linhas `wedding_gift*` do próprio espaço.
- Visitantes sem login não têm acesso direto às tabelas. O portal só usa as funções acima.
- O portal recebe só o próprio convite, resolvido pelo servidor a partir do hash do código. Não aceita ids vindos do cliente.
- O portal devolve apenas a disponibilidade agregada e as reservas do próprio convite. Para `fund`, não devolve soma, meta nem percentual. Não devolve nomes, outros convites, ids internos nem hashes.
- Anonimato `couple`: o nome do convite aparece só no painel do casal.
- Nada é escrito em Financeiro, Notas e recibos, Metas, Compras, Agenda, Tarefas nem em `wedding_expenses`. Também não há gatilhos ligando essas áreas.
- Imagens ficam no bucket privado `wedding`. O portal recebe links temporários gerados no servidor, só para presentes visíveis.
- Nenhum dado de cartão ou conta, nenhuma chave Pix inventada e nenhum valor de exemplo.

### 2.5 Testes e aceite

- **Testes automáticos de regras:**
  - Disponibilidade por tipo, expiração em 15 dias e limites de valor e quantidade: R$ 50.000,00 aceito, R$ 50.000,01 recusado.
  - O retorno do portal não traz progresso de fundo nem função de edição.
  - Formulários: campos obrigatórios por tipo.
  - Formato do retorno do portal sem campos privados.
- **Testes no banco, com usuário de teste em espaço próprio:**
  - Duas reservas simultâneas da última cota: só uma passa.
  - Uma reserva vencida libera a disponibilidade e vira `expired`.
  - Cancelar libera. Reabrir revalida.
  - O convite A não vê nem cancela as reservas do convite B.
  - Visitante sem login: 401 nas tabelas.
  - Membro de outro espaço: sem acesso.
  - Com o portal desligado, a seção não aparece e a reserva é recusada.
  - Pix vazio não é exibido.
- **Contagens antes e depois:**
  - Financeiro, recibos, metas, compras e `wedding_expenses` sem linhas novas.
  - 15 cômodos e 80 itens intactos.
  - Workspaces de teste preservados.
- **Navegador:** fluxo casal → ativar portal → convidado reserva → casal confirma, em 320/375/768/1024/1440px, sem rolagem horizontal e sem erros JS.
- **Verificações finais:** tipos, lint e todos os testes passando. Nova verificação de segurança antes de publicar.

### 2.6 Riscos e decisões

- **Riscos:**
  - A produção já tem a Fase 2 no ar, e as migrations valem na hora para a produção. Por isso as novas tabelas precisam nascer fechadas, e o portal de presentes desligado.
  - A interface nova só vai ao ar com publicação.
  - Expirar só quando alguém acessa é seguro, mas o estado gravado no banco pode ficar desatualizado até a próxima leitura. O cálculo de disponibilidade nunca depende desse estado.
- **Decisões fechadas:** teto de R$ 50.000,00; sem edição pelo convidado; sem progresso de fundos no portal; se o valor recebido for diferente do reservado, o casal ajusta ao confirmar.
- Nenhuma decisão de produto em aberto.

### Ao aprovar
- Primeiro passo: atualizar o `roadmap.md` com a Fase 3 e estas decisões. Isso não é permitido no modo de planejamento, por isso fica para depois da aprovação.
- Depois: migrations 0032/0033, telas e testes.
- Sem publicar e sem limpar workspaces.

## Fora do escopo
Checkout, gateway, Stripe/Mercado Pago, cartão, conciliação automática, envio de mensagens, organizadores, Cerimônia/Festa, limpeza de workspaces de teste, publicação.
