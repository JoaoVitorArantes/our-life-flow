# Diagnóstico — evolução incremental do Life AI

## Estado inicial (18/10/2026)

- Git sem alterações locais no início da inspeção. Nenhuma alteração em configuração de bundling; a tela em branco está fora desta etapa.
- Registro fechado de 14 leituras e nove intents de proposta, validação Zod, dispatch revalidado, preferências pessoais por espaço e histórico conversacional compartilhado já implementados.
- Auditoria mínima existente em `0014_ai_capability_execution_audit.sql`; leitura protegida por ator e membership. `accepted` representa autorização, não persistência posterior.
- Contextos corrigido em `0011`; preservado integralmente.
- Catálogo já funcional, porém sem detalhes de ferramentas ou histórico de execuções. Prompt ainda contém orientações com nomes fixos.
- Confirmação revalida plugin e workspace ativo, mas não reconsulta referências de cartão/conta/categoria/contexto/pagador depois de uma prévia editada.
- Inserts de tarefas/eventos/notas/metas duplicados entre formulário rápido e executor Inbox; extração delimitada permite uma única implementação sem mudar regras financeiras.
- Prévia editável existente; falta editar conteúdo da nota, conta da receita e contexto. Estado de salvamento precisa de `finally` e proteção contra confirmações simultâneas.
- Google Calendar/Gmail/Sheets não têm ferramentas nem cliente externo autorizado. Nenhuma conexão real será criada nesta etapa.

## Verificação inicial

`bunx vitest run src/features/plugins src/lib/agent/history.test.ts`: 6 arquivos, 23 testes aprovados. `package.json` não tem script de teste; Vitest está instalado. Compilação/typecheck são automáticos da plataforma. Não executar build/typecheck manualmente.

## Delimitação

Completar detalhes e histórico pessoal no catálogo; metadados descobertos a partir do registro; revalidar referências no servidor na confirmação; extrair somente as quatro mutações simples compartilhadas; melhorar prévias existentes e regressões. Sem refatoração global, novos provedores, conexões externas, alterações de RLS, dados reais ou publicação.

Edição/exclusão por chat, criação de Contextos, check-ins de hábitos, horário/prioridade de tarefas e correlação comprovada de auditoria/persistência não serão apresentados como capacidades existentes. Dependem de contratos de domínio e testes próprios; as telas atuais permanecem disponíveis.