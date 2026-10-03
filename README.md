# LifeFlow Companion

LIFE OS — PROMPT 01 — FUNDAÇÃO DO PRODUTO

Quero construir um sistema chamado Life OS.

O Life OS será um sistema pessoal de gestão de vida, inicialmente utilizado por duas pessoas: João e sua namorada Renifer.

O objetivo é centralizar em um único sistema:

finanças pessoais;

finanças compartilhadas do casal;

agenda;

tarefas;

faculdade;

esporte;

metas;

notas;

informações pessoais e compartilhadas.

O produto deve ter aparência de um produto SaaS moderno e premium, mas com sensação pessoal. Não quero aparência de ERP, sistema bancário tradicional ou dashboard genérico gerado por IA.

1. STACK E ARQUITETURA

Utilize uma arquitetura moderna e escalável.

Frontend:

React;

TypeScript;

Tailwind CSS;

componentes reutilizáveis;

design responsivo;

abordagem mobile-first;

arquitetura organizada por funcionalidades.

Backend:

Supabase;

Supabase Auth;

PostgreSQL;

Row Level Security (RLS);

Supabase Storage quando necessário.

O sistema deve ser preparado para futuras integrações via API, webhooks, WhatsApp, Telegram e IA.

Não crie integrações externas ainda.

Primeiro construa uma fundação sólida.

2. IDENTIDADE VISUAL

Nome:

Life OS

Tagline conceitual:

Your life, connected.

A identidade visual deve transmitir:

minimalismo;

tecnologia;

organização;

sofisticação;

vida pessoal;

calma;

controle.

Não quero:

visual gamer;

excesso de neon;

excesso de gradientes;

sombras pesadas;

excesso de cards;

aparência de ERP;

excesso de gráficos;

interface visualmente poluída.

Quero uma interface elegante, com bastante espaço negativo e excelente hierarquia visual.

3. TEMAS

O sistema deve possuir:

Dark Mode;

Light Mode;

preferência do sistema operacional.

O Dark Mode será a identidade visual principal.

Dark

Background principal:

#0B0D10

Surface:

#12151A

Elevated surface:

#181C22

Texto principal:

#F5F7FA

Texto secundário:

#9299A5

Light

Background:

#F7F8FA

Surface:

#FFFFFF

Texto principal:

#15181D

Texto secundário:

#68707D

Cor principal

Utilize violeta como cor de destaque:

#7C5CFC

Utilize essa cor principalmente em:

botões principais;

estados ativos;

links;

progresso;

elementos selecionados;

ações importantes.

Não transforme toda a interface em roxo.

Utilize cores semânticas de forma controlada:

verde para receitas/sucesso;

vermelho para despesas/erro;

amarelo para atenção;

azul para informação.

4. TIPOGRAFIA

Utilize Inter como fonte principal.

A interface deve possuir hierarquia clara entre:

títulos;

subtítulos;

labels;

valores;

textos auxiliares.

Valores financeiros podem utilizar uma aparência numérica diferenciada, mas sem exageros.

5. LAYOUT DESKTOP

Utilize uma sidebar vertical à esquerda.

Estrutura:

Dashboard
Financeiro
Agenda
Tarefas

Faculdade
Esporte
Nós
Metas
Notas

Configurações

A sidebar deve ser recolhível.

Quando aberta:

"💰 Financeiro"

Quando recolhida:

somente o ícone.

No topo da área principal deve existir uma Command Bar.

6. LAYOUT MOBILE

No mobile, substituir a sidebar por uma bottom navigation.

Estrutura principal:

Home
Financeiro
+
Agenda
Nós

O botão "+" deve ser visualmente destacado e representar a principal ação de criação rápida.

7. COMMAND BAR

Criar uma Command Bar global.

Desktop:

atalho Ctrl + K.

Mobile:

acesso pelo botão de ação rápida.

Placeholder:

"Pesquisar ou registrar algo..."

A Command Bar deve permitir futuramente:

buscar informações;

criar despesa;

criar receita;

criar evento;

criar tarefa;

criar meta;

criar nota;

registrar treino.

Nesta primeira versão, implemente as ações básicas de criação.

A arquitetura deve permitir adicionar interpretação por IA posteriormente.

8. AUTENTICAÇÃO

Utilizar Supabase Auth.

Criar:

login;

cadastro;

logout;

recuperação de senha;

sessão persistente.

Criar tabela profiles.

Estrutura:

profiles

id

name

email

avatar_url

created_at

updated_at

O profiles.id deve estar relacionado ao usuário autenticado do Supabase.

9. WORKSPACE

O sistema deve funcionar baseado em workspace.

Criar tabela:

workspaces

Campos:

id

name

owner_id

created_at

updated_at

Criar tabela:

workspace_members

Campos:

id

workspace_id

user_id

role

created_at

Roles:

OWNER

MEMBER

O workspace inicial será:

Life OS

O sistema deve ser preparado para futuramente suportar mais pessoas, sem assumir que sempre existirão somente dois usuários.

10. PRIVACIDADE

A arquitetura deve possuir dois níveis principais de visibilidade:

PRIVATE
SHARED

PRIVATE:
Somente o proprietário pode visualizar/modificar.

SHARED:
Os membros autorizados do workspace podem visualizar o registro.

A propriedade dos registros deve ser explicitamente armazenada.

Quando aplicável, utilizar:

workspace_id;

owner_id;

visibility.

Não utilizar apenas lógica visual no frontend para esconder dados.

A segurança deve ser implementada no banco usando RLS.

11. BANCO DE DADOS — FINANCEIRO

Criar as seguintes tabelas.

accounts

Campos:

id

workspace_id

owner_id

name

institution

account_type

initial_balance

current_balance

visibility

is_active

created_at

updated_at

Tipos:

CHECKING
SAVINGS
CASH
INVESTMENT
OTHER

O initial_balance representa o saldo informado pelo usuário no momento do cadastro.

O current_balance deve ser calculável a partir do saldo inicial e das transações.

Não depender exclusivamente de um saldo digitado manualmente.

cards

Campos:

id

workspace_id

owner_id

name

institution

credit_limit

closing_day

due_day

payment_account_id

visibility

is_active

created_at

updated_at

payment_account_id deve referenciar uma conta existente.

categories

Campos:

id

workspace_id

name

icon

color

type

created_at

Tipos:

INCOME
EXPENSE
BOTH

Criar categorias iniciais:

Alimentação
Transporte
Moradia
Faculdade
Lazer
Saúde
Casal
Dívidas
Investimentos
Salário
Outros

As categorias devem ser editáveis futuramente.

12. TRANSACTIONS

Criar tabela:

transactions

Campos:

id

workspace_id

owner_id

type

amount

description

transaction_date

category_id

account_id

card_id

visibility

is_shared

notes

created_at

updated_at

Tipos:

INCOME
EXPENSE
TRANSFER

Regras:

Uma despesa pode estar vinculada a uma conta ou cartão.

Uma receita pode estar vinculada a uma conta.

Uma transferência deve possuir conta de origem e conta de destino.

Não tratar transferência como receita ou despesa no cálculo do patrimônio.

Criar os campos necessários para:

source_account_id;

destination_account_id.

13. TRANSACTION SPLITS

Criar:

transaction_splits

Campos:

id

transaction_id

user_id

amount

percentage

Essa tabela permitirá dividir despesas compartilhadas entre João e Renifer.

Exemplo:

Restaurante R$200:

João R$100
Renifer R$100

Também deve permitir divisões diferentes:

João R$140
Renifer R$60

14. SETTLEMENTS

Criar:

settlements

Campos:

id

workspace_id

from_user_id

to_user_id

amount

status

created_at

settled_at

Status:

PENDING
SETTLED
CANCELLED

O objetivo é permitir controle de valores devidos entre os membros do workspace.

Exemplo:

Renifer deve R$100 para João.

O sistema deve conseguir representar essa pendência.

15. INSTALLMENTS

Criar:

installments

Campos:

id

transaction_id

total_installments

current_installment

installment_amount

start_date

O sistema deve conseguir representar:

R$3.000 em 10 parcelas.

Deve ser possível visualizar:

1/10
2/10
3/10
...
10/10

O sistema deve conseguir identificar parcelas futuras.

16. RECURRING TRANSACTIONS

Criar:

recurring_transactions

Campos:

id

workspace_id

owner_id

description

amount

type

category_id

account_id

frequency

start_date

end_date

next_date

is_active

Frequências iniciais:

WEEKLY
MONTHLY
YEARLY
CUSTOM

Não é necessário implementar um sistema complexo de automação agora, mas a estrutura deve estar preparada para isso.

17. CONCILIAÇÃO

O sistema deve considerar:

saldo inicial
+
receitas

despesas
+
entradas de transferência

saídas de transferência

saldo calculado

Criar uma estrutura para futuramente permitir conciliação.

A ideia:

Saldo calculado pelo Life OS:
R$3.200

Saldo informado pelo banco:
R$3.180

Diferença:
-R$20

Não implementar uma ferramenta complexa de conciliação agora.

Apenas estruturar o sistema corretamente para essa evolução.

18. DASHBOARD

Criar Dashboard inicial.

O dashboard deve mostrar:

Saudação

"Boa noite, João."

A saudação deve utilizar o nome do usuário autenticado.

Mostrar data atual.

Cards financeiros

Patrimônio total
Receitas
Despesas
Disponível

Agenda de hoje

Mostrar os eventos do dia.

Tarefas

Mostrar tarefas pendentes.

Metas

Mostrar metas em andamento.

Nós

Mostrar informações compartilhadas relevantes.

O dashboard deve ser limpo.

Não adicionar gráficos somente para preencher espaço.

19. NAVEGAÇÃO

Criar as páginas:

/dashboard
/financeiro
/agenda
/tarefas
/faculdade
/esporte
/nos
/metas
/notas
/configuracoes

Nesta primeira etapa, algumas páginas podem possuir estado inicial/placeholder elegante.

Não construir funcionalidades completas de Faculdade, Esporte, Metas e Notas ainda.

A prioridade é:

autenticação;

workspace;

permissões;

dashboard;

financeiro;

navegação.

20. QUICK ACTION

Criar botão global "+".

Ao clicar, mostrar:

Nova despesa
Nova receita
Novo evento
Nova tarefa
Nova meta
Nova nota
Novo treino

As opções que ainda não possuem backend completo podem apresentar uma interface preparada para implementação futura.

A criação de despesas e receitas deve funcionar de verdade.

21. UX FINANCEIRO

O usuário deve conseguir cadastrar uma despesa com o mínimo de passos possível.

Exemplo:

Valor:
R$32,90

Descrição:
Almoço

Categoria:
Alimentação

Pagamento:
Nubank

Pessoa:
João

Compartilhada:
Não

Salvar.

Para uma despesa compartilhada:

Compartilhada:
Sim

Mostrar:

João
Renifer

Divisão:

50/50
70/30
Personalizada

22. RESPONSIVIDADE

O sistema precisa funcionar muito bem em:

desktop;

notebook;

tablet;

celular.

Não simplesmente reduzir a interface desktop no mobile.

O mobile deve possuir uma experiência própria.

23. COMPONENTES

Criar componentes reutilizáveis para:

Sidebar;

Bottom Navigation;

Header;

Command Bar;

Quick Action;

Cards;

Modal;

Drawer;

Form;

Button;

Badge;

Avatar;

Empty State;

Loading State;

Error State;

Confirmation Dialog;

Toast.

24. QUALIDADE DO CÓDIGO

Não duplicar componentes.

Não colocar toda a aplicação em um único arquivo.

Organizar o código por domínio/feature.

Manter tipos TypeScript bem definidos.

Utilizar constantes para enums e categorias.

Criar funções reutilizáveis para cálculos financeiros.

Separar claramente:

UI
Lógica de negócio
Acesso ao banco
Tipos
Hooks

25. SEGURANÇA

Implementar RLS no Supabase.

Usuários só podem acessar registros aos quais possuem autorização.

Um usuário não deve conseguir acessar dados PRIVATE de outro usuário apenas alterando um ID na requisição.

Não confiar em validação exclusivamente no frontend.

Validar:

workspace membership;

ownership;

visibility;

permissões.

26. DADOS DE TESTE

Depois de criar o schema e autenticação, criar uma forma segura de inserir dados de demonstração.

Os dados de demonstração devem incluir:

Contas:

Nubank

Mercado Pago

Cartão:

Nubank

Algumas transações.

Alguns eventos.

Algumas tarefas.

Algumas metas.

Esses dados devem ficar claramente identificados como dados de demonstração e não devem ser misturados permanentemente com dados reais.

27. IMPORTANTE

Não tente implementar o Life OS inteiro nesta etapa.

NÃO implementar agora:

integração bancária;

WhatsApp;

Telegram;

IA;

sincronização com Google Calendar;

APIs externas;

notificações complexas;

automações;

importação de OFX;

Open Finance.

A arquitetura deve estar preparada para receber essas funcionalidades futuramente.

28. ORDEM DE IMPLEMENTAÇÃO

Execute nesta ordem:

Criar projeto/base visual.

Configurar tema Dark/Light.

Criar layout responsivo.

Configurar Supabase.

Criar autenticação.

Criar profiles.

Criar workspace.

Criar workspace_members.

Criar RLS.

Criar estrutura financeira.

Criar contas.

Criar cartões.

Criar categorias.

Criar transações.

Criar divisões compartilhadas.

Criar settlements.

Criar parcelamentos.

Criar recorrências.

Criar dashboard.

Criar Quick Actions.

Criar Command Bar.

Testar fluxo completo.

Corrigir problemas de segurança e permissões.

Só então finalizar a primeira versão visual.

29. REGRA FUNDAMENTAL

Antes de criar qualquer funcionalidade adicional, mantenha a arquitetura preparada para que o Life OS seja um sistema de longo prazo.

Não quero apenas uma demonstração visual.

Quero uma aplicação funcional, com banco de dados real, autenticação real, segurança real e componentes reutilizáveis.

Quando terminar essa etapa, apresente um resumo do que foi criado e quais partes estão prontas para a próxima etapa.

Não avance automaticamente para construir todos os módulos futuros.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://our-life-flow.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9dded571-b16e-48f1-b3b7-44a6d3096faa).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
