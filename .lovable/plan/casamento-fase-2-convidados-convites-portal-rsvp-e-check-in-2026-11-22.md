# Casamento — Fase 2: Convidados, convites, portal, RSVP e check-in

## 1. Auditoria (estado verificado)
- Rotas do casal em `/_authenticated/casamento*`: início, casa (cômodo/item), orçamento, preparativos, fornecedores, configurações e `$area` (placeholders "em breve", incluindo Convidados).
- Tabelas existentes (10, todas com 4 policies, `authenticated` + `user_is_workspace_member(workspace_id)`): plans, rooms, items, priorities, statuses, savings_goals, contributions, expenses, tasks, suppliers. Bucket privado `wedding` com policies por workspace. Trigger de bloqueio de workspace demo e sync realtime.
- Não existem: tabelas de convidados, rotas públicas do Casamento, rate limiting nativo no backend.
- Nada da Fase 1 será alterado: só tabelas, funções e rotas novas.

## 2. Telas do casal (dentro do tema Casamento)
- **Convidados** (`/casamento/convidados`): lista com busca, filtros (grupo, convite, RSVP, check-in), contadores reais (vagas totais, confirmados, recusados, pendentes). Cards no mobile, tabela legível no desktop.
- **Convidado/Grupo** (detalhe): dados, contato (opcional), restrições, acessibilidade, notas internas, histórico.
- **Convites**: criar convite *individual* ou *de grupo/família*; vagas de acompanhantes; gerar/regenerar/revogar link e código; copiar link ou mensagem pronta (envio manual pelo casal — sem e-mail/WhatsApp automático nesta fase).
- **Página pública do evento** (configuração): o que os convidados veem — tudo opcional e vazio por padrão (data, local, horários, orientações, mapa, mensagem). Botão "publicar" explícito; sem nada publicado o portal mostra só o RSVP.
- **Mensagens**: caixa de mensagens enviadas pelos convidados.
- **Check-in** (`/casamento/checkin`): tela mobile com busca por nome/código e leitura de QR; marca presença por pessoa, mostra se já entrou, permite desfazer com motivo (auditado).
- Dashboard ganha cartão de convidados com números reais (zero quando vazio).

## 3. Portal do convidado (público, sem login do Life OS)
- Rota `/convite/$token` (e `/convite` para digitar código). Visual do Casamento, sem menu do app.
- Mostra apenas: nome dos convidados daquele convite, vagas permitidas, conteúdo publicado pelo casal, status do RSVP e do check-in.
- Ações: confirmar/recusar por pessoa, nomear acompanhantes até o limite, informar restrições/acessibilidade, enviar mensagem ao casal.
- Nunca mostra outros convidados, contatos, notas internas, orçamento ou painel.

## 4. Convite híbrido (modelo)
Um **convite** é a unidade de acesso; ele contém 1..N **convidados**.
- Individual = convite com 1 convidado (+ acompanhantes opcionais).
- Família/grupo = convite com vários convidados, um link para todos.
- Acompanhantes: `max_companions` no convite; o servidor rejeita qualquer excesso.

## 5. Modelo de dados (migration aditiva única)
- `wedding_guest_groups` — rótulo/categoria (família, amigos…), configurável.
- `wedding_invitations` — workspace, tipo (individual|grupo), rótulo, max_companions, status (rascunho|enviado|respondido|revogado), `token_hash` (SHA-256), `code_hash`, `expires_at`, `revoked_at`, contadores de tentativa.
- `wedding_guests` — invitation_id, group_id, nome, contato opcional, restrições, acessibilidade, notas internas, `is_companion`, `rsvp` (pendente|sim|não), `responded_at`, archived_at.
- `wedding_checkins` — guest_id, checked_at, operador, `undone_at/undone_by/motivo`; índice único parcial "um check-in ativo por convidado".
- `wedding_guest_messages` — invitation_id, texto (limite), criado em, lido em.
- `wedding_public_content` — 1 por plano; campos opcionais + `published`.
- `wedding_guest_audit` — eventos mínimos (RSVP alterado, link regenerado, check-in/desfeito) sem copiar dados pessoais.
- `wedding_portal_attempts` — tentativas por hash de IP/código, para limitar abuso.
- Todas com `workspace_id`, FKs compostas para não cruzar workspace, GRANTs, RLS, bloqueio de demo.

## 6. Tokens e segurança do portal
- Token: 32 bytes aleatórios (base64url) só no link; banco guarda apenas o hash. Código curto opcional (8 caracteres sem ambíguos), também com hash. Exibido uma vez; regenerar invalida o anterior.
- Expiração padrão configurável (default: sem data fixa até o casal definir; revogação a qualquer momento).
- Portal acessa dados só por **RPCs `security definer`** (`portal_get`, `portal_rsvp`, `portal_message`) que recebem o token, validam hash/expiração/revogação e retornam somente o próprio convite. Convidados não têm policy de SELECT nas tabelas (anon sem acesso direto).
- Anti-enumeração: resposta idêntica e genérica para token inválido/expirado/revogado; limite simples de tentativas por código/IP via `wedding_portal_attempts` (o backend não tem rate limiting padrão; esta é uma solução própria e limitada — preciso da sua confirmação). Página com `noindex`.
- RSVP idempotente: atualização por convidado com verificação de pertencimento ao convite e de limite de acompanhantes dentro da transação.

## 7. Papéis
- Nesta fase: **casal = membros do workspace** (João e Renifer), acesso administrativo completo via RLS atual.
- **Convidado** = portador de token, apenas via RPC.
- **Equipe de check-in**: não criada agora (não assumir organizadores). Estrutura pronta para adicionar depois com permissão só de check-in.

## 8. Privacidade / LGPD e retenção
- Campos pessoais opcionais e mínimos; aviso de uso no portal ("dados usados só para organizar o casamento").
- Notas internas e contatos nunca saem por RPC pública.
- Auditoria sem conteúdo pessoal. Exportação e exclusão de convidado pelo casal; opção futura de anonimizar após o evento (configurável, sem data inventada).

## 9. Implementação técnica
- Rotas públicas TanStack (SSR leve) chamando server functions públicas que invocam as RPCs com cliente publishable; nada de Edge Functions.
- Server functions do casal com `requireSupabaseAuth`; regenerar token feito no servidor (gera aleatório, salva hash, devolve o token uma única vez).
- Check-in via RPC `wedding_checkin(guest_id)` / `wedding_checkin_undo(id, motivo)` que valida membership e impede duplicidade.
- QR gerado no cliente a partir do link (lib leve), sem serviço externo.

## 10. Testes e aceite
- Vitest de contratos: limite de acompanhantes, RSVP repetido, token inválido/expirado/revogado com resposta igual, hash nunca exposto, check-in duplicado bloqueado, desfazer auditado.
- Isolamento SQL com usuário de teste: portal de um convite não lê outro; anon sem acesso às tabelas; membro de outro workspace não vê convidados.
- Playwright no workspace de teste isolado: criar convite individual e de família, abrir link anônimo, RSVP, mensagem, check-in, em 320/375/768/1440 sem overflow.
- Auditoria final: 15 cômodos/80 itens do casal intactos; nenhum workspace de teste alterado; sem publicar.

## Decisões (com defaults)
1. Limite de tentativas próprio no portal — confirmar (default: ativado, simples).
2. Expiração dos links — default: válidos até revogar.
3. Convidado pode editar o RSVP depois? — default: sim, até o casal travar.
4. Conteúdo do evento — fica vazio até vocês preencherem.

Fora do escopo: presentes/Pix/pagamentos, cerimônia/festa, envio automático de convites, equipe de organizadores, publicação.
