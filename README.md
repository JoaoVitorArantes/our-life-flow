# Life OS

**Your life, connected.**

O Life OS é um sistema pessoal e compartilhado para organizar as áreas que compõem a vida cotidiana. Criado inicialmente para João e Renifer, ele reúne finanças, agenda, tarefas, rotinas, objetivos e informações compartilhadas em uma experiência única, disponível no desktop e no celular.

[![React](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3fcf8e?logo=supabase&logoColor=white)](https://supabase.com/)
[![PWA](https://img.shields.io/badge/Platform-PWA-5a0fc8)](https://developer.mozilla.org/docs/Web/Progressive_web_apps)

**Aplicação:** [our-life-flow.lovable.app](https://our-life-flow.lovable.app) · **Repositório:** [JoaoVitorArantes/our-life-flow](https://github.com/JoaoVitorArantes/our-life-flow)

## Visão do produto

O Life OS conecta planejamento, execução e acompanhamento em um espaço pessoal que também pode ser compartilhado. Cada pessoa mantém seus próprios registros privados e pode colaborar em informações do workspace, com autoria e acesso controlados.

## O que você pode fazer

- **Meu Dia** — reunir em uma visão diária os compromissos e itens que pedem atenção.
- **Financeiro** — acompanhar contas, cartões, transações, despesas compartilhadas e planejamento financeiro.
- **Dinheiro Livre** — consultar projeções e cenários financeiros para apoiar decisões do dia a dia.
- **Agenda e Tarefas** — organizar compromissos e acompanhar o que precisa ser feito.
- **Faculdade** — manter atividades e informações acadêmicas em contexto.
- **Esporte & Atividades** — registrar atividades e acompanhar sua vida ativa.
- **Nós** — compartilhar informações e acompanhar aspectos da vida a dois em um workspace comum.
- **Metas** — acompanhar objetivos pessoais e compartilhados.
- **Notas e Contextos** — guardar informações e relacioná-las às diferentes áreas da vida.
- **Compras** — organizar itens e necessidades de compra.
- **Rotinas & Hábitos** — estruturar rotinas e registrar acompanhamentos.
- **Life AI** — consultar informações do Life OS em linguagem natural. O assistente está disponível globalmente na experiência autenticada; ações que alteram dados passam por uma proposta e confirmação do usuário.

Os módulos evoluem junto com o produto. A disponibilidade de cada fluxo pode variar conforme o estado atual de desenvolvimento.

## Experiência e plataformas

A interface se adapta a desktop, tablet e celular, com navegação apropriada para cada tamanho de tela. O Life OS inclui um manifesto PWA e pode ser instalado em navegadores compatíveis.

A preparação para Android e Google Play está no roadmap. **O aplicativo ainda não está publicado na Google Play.**

## Prévia

![Prévia atual do Life OS](https://screenshot2.lovable.dev/lovp_4g5mcd7wzz8qkb0yzwwj0cvnnj/925bc05f2ffab7a90197e01747caf2d3_1791040158524.png)

## Arquitetura e tecnologias

| Camada | Tecnologias |
| --- | --- |
| Aplicação web | React 19, TypeScript, TanStack Start, TanStack Router e Vite |
| Interface | Tailwind CSS, Radix UI e componentes reutilizáveis |
| Dados e autenticação | Supabase Auth e PostgreSQL |
| Acesso a dados | Drizzle ORM, schema tipado e migrations |
| Segurança de dados | Row Level Security (RLS) e autorização por workspace |
| Assistente | AI SDK, ferramentas no servidor e execução de ações após confirmação |

A organização por domínio ajuda a manter interface, regras de negócio e acesso a dados separados. As tabelas e migrations do banco ficam em `drizzle/`; componentes de produto ficam organizados por área em `src/components/`; lógica específica do assistente e da caixa de entrada fica em `src/lib/` e `src/features/`.

## Segurança e privacidade

O Life OS distingue registros privados de registros compartilhados. A autorização deve ser aplicada no banco e no servidor, além da interface: acesso ao workspace, propriedade e visibilidade são considerados nas operações. As consultas do assistente usam o cliente autenticado e as permissões do usuário; gravações propostas exigem confirmação antes de serem executadas.

Nunca inclua credenciais, tokens ou dados pessoais reais em commits, exemplos públicos ou capturas de tela. Use configurações de ambiente locais e segredos gerenciados pela plataforma de implantação.

## Status e roadmap

O Life OS está em desenvolvimento ativo e possui uma versão web publicada. O roadmap atual inclui:

- concluir o envio automático de convites por e-mail após configurar o domínio remetente;
- preparar a distribuição Android e os requisitos de publicação na Google Play;
- continuar validando a experiência compartilhada, os módulos e os fluxos de assistência por IA.

A publicação na loja dependerá de empacotamento, assinatura, testes e conclusão dos requisitos do Google Play.

## Desenvolvimento local

### Requisitos

- [Bun](https://bun.sh/) — o repositório mantém um lockfile do Bun.
- Acesso às configurações de desenvolvimento do projeto para autenticação e serviços de dados.

### Configuração

1. Clone o repositório e entre na pasta do projeto:

   ```sh
   git clone https://github.com/JoaoVitorArantes/our-life-flow.git
   cd our-life-flow
   ```

2. Configure as variáveis de ambiente exigidas pelo runtime em um arquivo local `.env`, usando os valores fornecidos para o seu ambiente. Não versione esse arquivo nem compartilhe seus valores.

   Para operações de migração com Drizzle, `drizzle.config.ts` lê `LOVABLE_DB_MIGRATION_URL`. Obtenha esse valor da configuração segura do ambiente; ele não deve ser publicado.

3. Instale as dependências e inicie o servidor de desenvolvimento:

   ```sh
   bun install
   bun run dev
   ```

### Comandos disponíveis

| Comando | Finalidade |
| --- | --- |
| `bun run dev` | Inicia o servidor local de desenvolvimento |
| `bun run build` | Gera a build de produção |
| `bun run preview` | Serve localmente a build gerada |
| `bun run lint` | Executa o ESLint |

## Estrutura do projeto

```text
drizzle/
  migrations/        Migrações do PostgreSQL
  schema.ts          Schema do banco
src/
  components/        Interface organizada por domínio e componentes comuns
  features/          Fluxos de produto e regras de execução
  lib/               Integrações e lógica de servidor
public/              Ícones, manifesto PWA e arquivos estáticos
```

## Desenvolvimento e contribuições

Este repositório acompanha um produto em desenvolvimento. Antes de propor uma mudança, verifique o escopo e os padrões já adotados no projeto. Prefira alterações pequenas, tipadas e organizadas por domínio; preserve as regras de autorização no banco/servidor e não inclua segredos nos commits.
