# Life OS Ecosystem — Fase 2: provedores configuráveis

## Execução e escopo

A Fase 1 estava concluída; não havia edição concorrente observada. Esta fase não repete a auditoria de Contextos. O agente global, suas 15 ferramentas internas e confirmação de propostas continuam no mesmo fluxo. Não houve alteração de RLS, dados reais, contas, visibilidade, migration ou publicação.

## Implementação

- Adaptadores server-side: Lovable AI (Responses atual preservado), OpenAI (Responses), Gemini (GenerateContent), Anthropic (Messages), OpenRouter (compatível Chat Completions).
- Seletor funcional no próprio `AgentChat`, reutilizado pela central e painel global: credencial compartilhada/pessoal, provedor, modelo, consentimento e revogação. Não existe input de chave.
- Seleção explícita por sessão de chat, usuário e workspace; não persistida no browser/DB. Trocar identidade ou workspace invalida consentimento; trocar modelo/provedor exige novo aceite. Uma nova instância do chat pede seleção novamente. O autoenvio aguarda seleção.
- O servidor verifica sessão, acesso à conversa, deriva workspace da conversa e valida consentimento para usuário/workspace/provedor/modelo. Não confia em IDs de autorização escolhidos pela IA.
- Ferramentas e chamadas ficam no servidor; gravações continuam somente após Confirmar. Consentimento autoriza envio do histórico compartilhado e dados acessíveis ao chamador, incluindo resultados das ferramentas. Não representa consentimento separado do parceiro nem muda compartilhamento.
- Sem fallback entre provedores/modelos; falhas encerram a chamada. Retries automáticos nesta chamada foram desativados. OpenRouter recebe `allow_fallbacks: false` e `require_parameters: true`; sem URLs configuráveis ou roteamento `auto`.
- Catálogo autenticado retorna exclusivamente nomes, modelos e estados não secretos; nunca retorna chave, parte da chave, tamanho, hash ou nome resolvido da credencial. Erros de streaming não registram objetos crus do provedor.

## Secret store: disponível e bloqueado

A listagem de segredos confirmou um cofre de **segredos do projeto** já disponível, com Lovable AI provisionado. Não há credenciais customizadas OpenAI/Gemini/Anthropic/OpenRouter configuradas. Presença é mostrada como **configurada, não verificada**, nunca como válida/conectada.

Credenciais customizadas compartilhadas ficam apenas em Project Settings → Secrets, vinculadas a exatamente um workspace pelo nome servidor. Não há fallback para uma chave global do projeto. Membros autenticados desse espaço podem usar a credencial compartilhada após consentimento individual; não podem lê-la.

**Credenciais pessoais estão bloqueadas:** não existe cofre server-side por usuário configurado. Não foi criado armazenamento em tabela cliente, criptografia sem chave, formulário de cadastro, secret de teste ou credencial inventada. Habilitar o modo pessoal requer futuramente um cofre acessível apenas no servidor, identidade autenticada + workspace, provisionamento/rotação/revogação segura e testes de isolamento. Project Settings → Secrets não é um cofre pessoal para usuários finais.

## Configuração mínima — canal seguro

O dono deve obter a credencial real no serviço escolhido e adicioná-la em **Project Settings → Secrets**, nunca no chat ou código. Para um workspace de UUID `aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`, o formato do **nome** é:

```text
LIFE_AI_OPENAI_aaaaaaaa_bbbb_cccc_dddd_eeeeeeeeeeee_API_KEY
LIFE_AI_GEMINI_aaaaaaaa_bbbb_cccc_dddd_eeeeeeeeeeee_API_KEY
LIFE_AI_ANTHROPIC_aaaaaaaa_bbbb_cccc_dddd_eeeeeeeeeeee_API_KEY
LIFE_AI_OPENROUTER_aaaaaaaa_bbbb_cccc_dddd_eeeeeeeeeeee_API_KEY
```

Esse UUID é apenas explicação do formato, não um workspace criado. Use o ID real do espaço autorizado, substituindo hífens por underscores. Configure somente o provedor escolhido; nenhuma credencial foi solicitada ou gravada nesta execução. Lovable AI não requer chave manual. Segredos customizados atualizam a prévia; o publicado só os recebe após publicação futura explícita pelo dono — nenhuma publicação feita agora.

## Modelos e capacidades

Catálogo inicial conservador baseado nas tabelas de capacidade da documentação atual do AI SDK: OpenAI `gpt-6-astra`, Gemini `gemini-4-argon`, Anthropic `claude-sonnet-5`; Lovable AI mantém `openai/gpt-6-astra`. As referências listam texto e ferramentas, não comprovam disponibilidade na conta, validade da chave ou custo. Modelos de imagem/áudio ou sem ferramentas não são selecionáveis.

OpenRouter usa somente IDs retornados pelo endpoint público fixo `/api/v1/models` com texto de entrada/saída e `supported_parameters` contendo `tools`; protocolo de streaming do adaptador compatível. Só consulta metadados se uma credencial está configurada; sem enviar chave, histórico ou dados ao catálogo. Indisponibilidade do catálogo bloqueia seleção. Não há preços estimados nem modelos digitados livremente.

Referências consultadas: https://ai-sdk.dev/providers/ai-sdk-providers/openai, https://ai-sdk.dev/providers/ai-sdk-providers/google, https://ai-sdk.dev/providers/ai-sdk-providers/anthropic, https://ai-sdk.dev/providers/openai-compatible-providers e https://openrouter.ai/docs/api-reference/models/get-models.

## Arquivos

- `src/lib/agent/providers/contracts.ts`: seleção, consentimento, capacidades, validação fechada.
- `catalog.server.ts`: resolução server-only de credenciais por espaço, catálogo não secreto.
- `provider.server.ts`: adaptadores por request, sem fallback.
- `providers.functions.ts`: leitura autenticada do catálogo com associação conferida.
- `run-id.server.ts`: helper do Gateway para correlação por request.
- `contracts.test.ts`: regressões seguras sem credenciais reais.
- `src/components/agent/provider-selector.tsx` e `agent-chat.tsx`: seleção e consentimento.
- `src/routes/api/agent.ts`, `package.json`, `bun.lock`, `AGENTS.md`, `roadmap.md`.

## Validação e pendências

Testes unitários sem credenciais cobrem isolamento de nomes de secrets por workspace, consentimento por identidade/workspace/modelo/provedor, bloqueio pessoal, bloqueio sem credencial, filtro de capacidades e rejeição de campos de chave/URL. `bunx vitest run`: 30 testes passaram em 10 arquivos, incluindo 7 testes desta fase. Lint direcionado: zero erros e 4 avisos no AgentChat (Fast Refresh e dependências de hooks). Validação da interface autenticada permanece bloqueada por ausência de sessão autorizada; não foi contornado o login.

Nenhuma chamada de geração foi feita nesta fase; disponibilidade, validade, faturamento e tool-calling real de cada provedor permanecem não verificados até o dono configurar credenciais e autorizar uso real. Testes simulados não substituem esse fluxo. A autorização da conversa compartilhada continua sujeita à auditoria existente; histórico cliente amplo não foi endurecido fora do escopo.

Google/Microsoft como conectores de dados ficam para fases seguintes; Gemini é apenas provedor de geração, não acesso a Calendar/Gmail/Drive. Nenhuma conta foi conectada.