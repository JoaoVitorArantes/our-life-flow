# Plugins por IA

As preferências são individuais e separadas por espaço. Desativar uma capacidade do Life AI não desativa o módulo nem altera o acesso do parceiro.

## Funcional hoje

- Financeiro: consultas existentes de Dinheiro Livre, lançamentos, tendências, cartões, contas a vencer, parcelas e saldo compartilhado; propostas de despesas/receitas.
- Agenda, Tarefas, Metas, Compras e Esporte: consultas existentes e propostas de novos registros.
- Contextos: consulta de orçamento e despesas vinculadas. Não cria/edita contextos pela IA; esses fluxos continuam no formulário.
- Rotinas: consulta de ocorrências e check-ins, sem nova ferramenta de escrita.
- Notas: proposta de nova anotação; não há ferramenta de leitura de notas.
- Meu espaço: proposta de renomeação, sujeita à mesma permissão do formulário.
- Todas as propostas passam pela confirmação existente. A preferência é reconsultada no servidor antes da execução; o usuário e o espaço ativo são resolvidos pela sessão.
- Leituras integradas de Contextos e Agenda requerem também Financeiro e Rotinas, respectivamente.

## Serviços externos

Foram inspecionados os catálogos reais de App Connectors e App User Connectors da Lovable. Google Calendar, Gmail e Google Sheets estão disponíveis na plataforma, mas nenhum cliente App User Connector está configurado para eles neste workspace. Por isso aparecem como **Não conectado**, sem ferramentas nem botão de consentimento fictício.

A conexão existente de Google Search Console está vinculada ao projeto, mas pertence ao construtor e não representa uma autorização dos usuários do Life OS. Não foi utilizada nem transformada em integração pessoal.

Para habilitar um provedor pessoal futuramente, o administrador precisa configurar e vincular seu cliente em **App User Connectors** na Lovable, definir escopos mínimos e permitir acesso offline. Cada usuário deve então consentir separadamente. O retorno OAuth do provedor é `https://connector-gateway.lovable.dev/api/v1/app-users/oauth2/callback`. Só depois desse setup pode ser implementado e validado o fluxo de consentimento deste provedor no app. Nenhuma conta externa foi conectada ou dado enviado nesta implementação.

## Contrato e segurança

O registro fechado declara IDs estáveis, categoria, ferramentas, intents, dependências, escopos, leitura/escrita, confirmação e configuração. Ferramentas desconhecidas, plugins externos não configurados e intents desativados falham fechados. As configurações persistidas atualmente aceitam apenas um objeto vazio; não aceitam URLs arbitrárias ou credenciais.

As preferências usam RLS por usuário e associação ao workspace. O servidor usa o cliente autenticado, nunca acesso administrativo para consultas. Discovery, cada dispatch, propostas e confirmação verificam o registro e as preferências atuais. As permissões existentes dos registros continuam sendo a fronteira final das mutações.

## Validação e pendências

Testes automatizados cobrem validação de contextos, plugins desativados, confirmação de propostas antigas, intents desconhecidos, dependências e associação/permissão no servidor. A verificação automática do projeto confere tipos. O lint completo tem dívida preexistente de formatação; os arquivos deste trabalho são verificados separadamente.

O teste autenticado real de criar/editar/recarregar contextos, isolamento entre as duas contas e interação com o catálogo depende de uma sessão da prévia. A tentativa de gerar essa sessão não foi autorizada neste ambiente; testes com mocks ou somente deslogado não comprovam esses fluxos.

Não houve publicação, alteração de contas externas nem exclusão de contextos existentes.