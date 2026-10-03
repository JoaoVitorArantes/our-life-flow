# Life OS — Guia de demonstração em feira

Público-alvo: bancas técnicas e avaliadores.

> **Importante:** o Life OS precisa de internet para login, dados vivos, sincronização e IA. Não há modo offline. Leve um hotspot de reserva.

## 1. Preparação feita por um administrador (uma vez)

1. Crie uma conta dedicada à demonstração pelo cadastro normal do app, com um e-mail exclusivo da equipe (nunca uma conta pessoal). Não publique essa senha em material impresso nem no código.
2. Ao entrar pela primeira vez, o app cria automaticamente um workspace para essa conta. Descubra o id dele (Backend → tabela `workspaces`, filtrando pelo `owner_id` da conta demo).
3. Marque **somente esse** workspace como demonstração, executando como administrador no SQL do backend:

   ```sql
   update public.workspaces set is_demo = true, name = 'Life OS Demo' where id = '<id-do-workspace-demo>';
   ```

   Usuários comuns não conseguem fazer isso: um gatilho no banco bloqueia qualquer alteração de `is_demo` vinda do app.
4. Opcional: para mostrar a sincronização entre duas pessoas, crie uma segunda conta demo e convide-a pelo próprio app (Configurações → Workspace).
5. Entre com a conta demo → Configurações → **Preparar / resetar demonstração**. O banco valida que o workspace é demo, apaga os registros fictícios e recria o conjunto completo numa única operação.

Garantias:
- Os botões de demonstração só aparecem em workspaces marcados como demo, com faixa amarela fixa “Ambiente de demonstração”.
- Preparar e resetar rodam no banco e recusam qualquer workspace que não seja demo, mesmo se chamados fora da interface.
- O reset apaga apenas registros `is_demo = true` daquele workspace, em todas as tabelas que têm essa marcação, de uma vez só (ou tudo, ou nada).
- Todos os dados são fictícios: “Banco Fictício”, “Pessoa Exemplo”, “Cidade Exemplo” etc.

## 2. Roteiro de 5 minutos

| Tempo | O que mostrar | Ponto técnico |
| --- | --- | --- |
| 0:00–0:40 | Dashboard e faixa de demonstração | Problema: vida financeira e rotina espalhadas. Stack: TanStack Start (SSR + funções no servidor), React Query, PostgreSQL com RLS. |
| 0:40–1:40 | Financeiro: saldo, fatura do Cartão Demo, parcelamento do notebook, aluguel recorrente, “Dinheiro livre” | Cálculo de dinheiro livre a partir de compromissos futuros; parcelas e recorrências derivadas sem duplicar registros. |
| 1:40–2:30 | Contextos: “Viagem de férias” com orçamento e “Semestre letivo” ligando tarefas, eventos e gastos | Modelo relacional por workspace; gatilhos impedem referências entre workspaces. |
| 2:30–3:30 | **Sincronização em dois aparelhos** (seção 3) | Supabase Realtime filtrado pelo workspace; o banco só entrega o que a política RLS permite ler; o cache é invalidado em lote. |
| 3:30–4:30 | Life AI: “Quanto gastei com alimentação este mês?” e “Crie uma tarefa para amanhã” | A IA não acessa o banco: usa ferramentas controladas que consultam com a permissão do próprio usuário; escritas viram propostas que exigem “Confirmar”. |
| 4:30–5:00 | Segurança e perguntas | Isolamento por workspace, modo demo marcado só por administrador, reset atômico no servidor. |

## 3. Mostrar a sincronização em dois aparelhos

1. Antes, entre com a conta demo (ou as duas contas do workspace demo) em dois aparelhos, ambos na mesma tela (ex.: Tarefas).
2. No aparelho A, crie uma tarefa ou marque uma como concluída.
3. Em cerca de 1 segundo, o aparelho B atualiza sozinho, sem recarregar.
4. Se aparecer “Reconectando a sincronização…”, verifique a internet; ao reconectar os dados se atualizam. Trocar de app e voltar também força atualização.

## 4. Resetar os dados entre visitantes

Configurações → **Preparar / resetar demonstração**. Leva poucos segundos. Faça isso antes de cada avaliação ou a cada hora.

## 5. Checklist pré-evento

- [ ] Internet do local testada + hotspot de reserva com dados móveis.
- [ ] Carregadores, cabos e extensão; aparelhos com bateria cheia.
- [ ] Contas pessoais deslogadas do Life OS, do Google e do navegador nos aparelhos da banca.
- [ ] Nenhuma aba ou tela com dados reais aberta; histórico do navegador limpo.
- [ ] Logado somente na conta demo; faixa amarela de demonstração visível.
- [ ] Dados resetados minutos antes de começar.
- [ ] Teste rápido da sincronização entre os dois aparelhos.
- [ ] IA: combine perguntas curtas, evite deixar visitantes usarem livremente (custo e tempo); acompanhe o consumo de créditos de IA.
- [ ] Fixação de tela (Android) ou modo quiosque para impedir sair do app.
- [ ] Plano B: capturas de tela ou vídeo curto caso a internet caia.
