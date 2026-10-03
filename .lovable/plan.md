# Life OS — análise para Android, sincronização e demo de feira

Análise apenas. Nada foi alterado. O `.env` não foi lido.

## 1. Situação atual (com evidências)

- **App:** TanStack Start + Vite, servidor Nitro em edge worker (`vite.config.ts`, `src/server.ts`). Usa server functions (`src/lib/inbox/*.functions.ts`) e a rota `/api/agent` (agente de IA em streaming). O app **precisa** do servidor online: não dá para gerar um pacote 100% estático.
- **Área logada:** `src/routes/_authenticated/route.tsx` usa `ssr: false` + `supabase.auth.getUser()` no navegador. Sessão salva no navegador.
- **Login:** e-mail/senha, Google via `lovable.auth.signInWithOAuth`, e links de e-mail montados com `window.location.origin` (`src/routes/auth.tsx`, linhas 62/77/94).
- **Realtime:** a publicação `supabase_realtime` **está vazia** (verificado no banco). Nenhum código usa `channel`/`postgres_changes`. Ou seja, hoje **não existe sincronização ao vivo** entre aparelhos.
- **Recarregar dados:** `new QueryClient()` sem opções (`src/router.tsx`) → padrão do React Query: staleTime 0, recarrega ao voltar o foco da janela e ao reconectar. As mudanças do parceiro aparecem quando você troca de app/aba ou navega, não na hora. O root também invalida tudo quando o login muda.
- **Segurança do banco:** 30 tabelas públicas, **todas com RLS ativo** (0 sem RLS). Migrações em `supabase/migrations` (24) + `drizzle/migrations` (0000–0005).
- **Demo seed:** `src/features/demo/seed.ts`, acionado em Configurações. Insere dados com `is_demo = true` **dentro do workspace real do usuário** (contas, cartão, transações, eventos, tarefas, metas). Tem nomes reais ("Cinema com a Renifer"). `clearDemoData` só limpa 7 tabelas, mas `is_demo` existe em 14 (ex.: parcelamentos, empréstimos, contextos, recorrências não são limpos).
- **PWA:** `public/manifest.webmanifest` existe (standalone, start_url `/dashboard`, ícones 192/512 + maskable + SVG), ligado no `__root.tsx`. **Não há service worker** (nada de `serviceWorker`/`vite-plugin-pwa`). Sem modo offline.
- **Deep links:** não existe `public/.well-known/assetlinks.json`. Sem configuração de App Links.
- **Mobile:** bottom nav com safe-area, gavetas responsivas e botão Life AI já ajustados em sessões anteriores (testado 320–1920 px; o botão Life AI ainda não foi testado num celular físico).

## 2. Recomendação: TWA (Trusted Web Activity)

Motivo: o app depende de servidor (server functions, `/api/agent`, SSR das páginas públicas). O TWA abre o site publicado (`https://lifejvrenii.com`) em tela cheia via Chrome, então tudo continua funcionando igual, com atualização instantânea sem novo envio à loja.

- **Capacitor:** exigiria empacotar arquivos estáticos e apontar chamadas para o servidor remoto — conflita com SSR/server functions e com o login Google (OAuth dentro de WebView é bloqueado pelo Google). Só vale se precisar de recursos nativos (notificações push nativas, câmera avançada, widgets).
- **Caminho intermediário:** Capacitor com `server.url` apontando para o site — funciona, mas é basicamente um TWA pior (WebView, problemas com Google login).

Requisitos do TWA que faltam: `assetlinks.json` e, para aprovação estável, um service worker mínimo (Chrome/Play recomendam boa experiência offline; hoje não há).

## 3. O que dá para aplicar agora (sem Play Console/keystore)

1. Completar manifesto: `id`, `screenshots` (formato estreito e largo), `categories`, `lang: pt-BR`, ícone maskable dedicado com margem segura.
2. Service worker controlado (vite-plugin-pwa, navegação NetworkFirst, sem registrar no preview) + tela offline simples. Opcional mas recomendado para TWA.
3. **Realtime:** adicionar à publicação as tabelas do dia a dia (transações, tarefas, eventos, metas, notas, rotinas/logs, compras, ai_messages) e um hook único que, ao receber mudança do workspace atual, invalida as queries correspondentes. RLS já filtra o que cada um recebe.
4. Ajustar React Query: `staleTime` curto (ex.: 30 s) e manter refetch ao focar/reconectar.
5. Corrigir `clearDemoData` para limpar todas as 14 tabelas com `is_demo`.
6. Página de política de privacidade e de exclusão de conta (exigidas pela Play Store).
7. Gerar o projeto TWA com Bubblewrap/PWABuilder já em modo de teste (pode usar chave de debug local).

## 4. Depende da sua conta/domínio

- Conta Google Play Console (taxa única de US$ 25) e verificação de identidade.
- Keystore de assinatura (ou Play App Signing) → **impressão SHA-256** para o `assetlinks.json`.
- Nome do pacote definitivo (ex.: `com.lifejvrenii.app`) — não muda depois.
- Domínio principal definitivo (`lifejvrenii.com` vs `www`) servindo `/.well-known/assetlinks.json`.
- Atualizar URLs permitidas de redirecionamento do login para o domínio final.
- Ficha da loja: textos, capturas, ícone 512, banner 1024×500, classificação etária, formulário de segurança de dados (o app coleta dados financeiros e usa IA).
- Contas novas pessoais exigem teste fechado com 12+ testadores por 14 dias antes da produção.

## 5. Design seguro para demo de feira

- **Usuário e workspace dedicados** só para demo (ex.: "Demo Life OS"), nunca o espaço do casal. Nada de entrar com sua conta pessoal no aparelho da feira.
- **Dados 100% fictícios** num seed próprio para esse workspace, sem nomes reais (trocar "Renifer" e similares).
- **Reset fácil:** botão/rotina que apaga tudo `is_demo` do workspace demo e semeia de novo (antes de cada visitante ou a cada hora).
- **Bloqueios no modo demo:** sem convite de parceiro, sem troca de senha/e-mail, sem exclusão de conta, IA com limite de uso por dia (custo).
- Aparelho com bloqueio de app (fixar tela do Android) e sessão do Google desconectada.
- Cuidado: o seed atual roda no workspace de quem clicar — mantê-lo escondido ou restrito ao workspace demo.

## 6. Riscos e limitações concretos

- Sem internet o app não abre (sem service worker; e mesmo com ele, dados exigem rede).
- TWA depende do Chrome no aparelho; em aparelhos sem Chrome cai para outro navegador ou WebView.
- Se o `assetlinks.json` falhar, aparece a barra de endereço no topo do app.
- Sem Realtime, o casal vê dados desatualizados até voltar ao app.
- Realtime aumenta conexões abertas; precisa limpar canais ao trocar de workspace.
- Notificações push não existem hoje; no TWA exigiriam web push (FCM) à parte.
- Atenção à política da Play sobre apps financeiros e IA (declarar uso de dados).
- Custo da IA em feira sem limite.

## Próximo passo sugerido

Aprovar este plano para eu implementar os itens 1–6 da seção 3 (sem tocar em conta/keystore), em etapas, começando por Realtime + correção do demo.
