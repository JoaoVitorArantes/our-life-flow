# Roadmap

## Etapa 20/10/2026 (2) — Faculdade privada por pessoa
- [ ] Migration aditiva 0017: owner_id nas 4 tabelas acadêmicas (backfill de created_by), RLS por dono+workspace, FKs compostas/trigger de integridade dono+workspace.
- [ ] Consultas, mutações, importação e read-back escopados por owner_id=userId; ferramenta `academics` e revalidação de disciplina por dono no servidor.
- [ ] Dois atalhos de navegação por membro real ("Faculdade — <nome>"), rota /faculdade/$ownerId com estado sem acesso para não-dono.
- [ ] Testes de contrato/política (fixtures/mocks), regressão das ações acadêmicas do AI, typecheck/build/lint; documentar se 0017 foi aplicada; não publicar.

## Etapa 20/10/2026 — erro do chat e fundação acadêmica
- [x] Fase 1: provar causa do 400 do chat (envelope do DefaultChatTransport v7 com id/trigger/messageId rejeitado pelo schema estrito) com teste de captura do payload real; corrigir agentBodySchema mantendo strict e validações.
- [x] Fase 2: migration aditiva 0016 (períodos, disciplinas, avaliações, aulas) com workspace_id, RLS por membro e grants; módulo Faculdade (BSI/UFU, currículo 2022-2, ingresso 2025) com pendências conhecidas marcadas como informação do usuário, importação CSV/JSON com prévia validada, frequência por presença e progresso com avisos de dados faltantes.
- [x] Plugin "academico" no registry central: leitura `academics` e intents `create_evaluation`/`log_class` com confirmação, revalidação de disciplina no servidor e read-back após gravação.
- [x] 107 testes aprovados, tipos limpos, build OK; lint direcionado 0 erros novos.
- [ ] Verificar gravação acadêmica real e isolamento João/Renifer — bloqueado: requer espaço de teste isolado e sessões autorizadas, sem dados reais.


## Life AI — operações unificadas (pedido de 18/10/2026)
- [x] A: catalogar operações reais de todos os módulos e lacunas do agente em docs/life-ai-evolution-diagnosis.md.
- [x] B: integrar criação, consulta, edição, arquivo e lixeira de Contextos aos serviços existentes, com confirmação e read-back.
- [x] C inicial: expor leitura de notas e detalhes de contextos sem duplicar regras.
- [ ] C restante: ampliar demais módulos após validação central de Contextos — bloqueado nesta etapa pela verificação isolada pendente.
- [x] D inicial: normalizar campos opcionais, orientar sequência confirmada e testar encaminhamento do ID real/valor fornecido.
- [ ] D real: verificar diálogo sequencial com modelo e persistência — depende de ambiente de teste autorizado.
- [x] E isolada: testar contratos, confirmação, escopo simulado, falhas e regressões.
- [ ] E real: criação/consulta/edição/recarga e isolamento João/Renifer — depende de espaço de teste isolado e sessões autorizadas, sem dados reais.
- [x] Documentar causa, cobertura por módulo, alterações e limitações; não publicar.

## Integrações Google individuais
- [x] Implementar leitura pessoal na Agenda sem copiar registros, orientar consentimento separado e verificar início autenticado; 53 testes aprovados.
- [ ] Verificar eventos reais após consentimento separado de João e Renifer — bloqueado: cada pessoa precisa autorizar a própria conta Google na prévia.
- [x] Diagnosticar arquitetura existente e vincular cliente OAuth do Calendar com acesso offline.
- [x] Implementar autorização pessoal do Calendar, reconexão e desconexão; abertura real do Google verificada na prévia autenticada, sem consentir nem publicar.
- [ ] Implementar conexão pessoal segura, leitura Calendar e ferramentas reais do Life AI após vinculação do cliente.
- [ ] Validar consentimento e eventos reais com isolamento entre usuários, sem publicar.
- [ ] Aplicar o padrão ao Gmail e Sheets somente após validação do Calendar.
- [x] Documentar configuração, testes e limitações em docs/google-calendar-oauth.md.

- [x] Verify reported startup errors and isolate diagram initialization without changing bundling, data or deployment — local authenticated opening/reload and real diagram passed; reported hosted chunk not accessible (401).

## Evolução incremental solicitada em 18/10/2026
- [x] Diagnosticar estado atual e preservar implementações válidas
- [x] Completar metadados e descoberta de capacidades reais no catálogo/agente
- [x] Expor histórico pessoal de execuções com escopo protegido
- [x] Revalidar referências e melhorar prévias/recuperação sem duplicar regras
- [x] Executar regressões focadas e documentar capacidades, lacunas e limites
- [ ] Verificar persistência e acesso compartilhado com dados de teste isolados — depende de ambiente/sessões autorizados sem dados reais

- [x] Completar contratos e cobertura bidirecional das ferramentas/intents existentes
- [x] Revalidar autorização, registrar metadados mínimos e proteger histórico recebido pelo agente
- [x] Ajustar estados do catálogo/chat, documentar limites e executar testes focados
- [ ] Validar gravação em Contextos e todos os módulos — bloqueado: requer dados de teste isolados e autorização; a sessão disponível foi usada somente para leitura do catálogo
- [x] Auditoria estruturada: evidências e riscos documentados em docs/security-functionality-audit.md
- [x] Varredura possível sem sessão: 29 testes, lint direcionado, verificação automática e telas públicas
- [x] Relatório com evidências e limites; nenhuma implementação nova de plugins
- [x] Endurecer replay do histórico do Life AI sem aceitar papéis/resultados fabricados como autoridade
- [ ] Restringir visibilidade de aportes — fora desta etapa; depende de aprovação específica

- [x] Corrigir auditoria que bloqueava contextos; validar campos e erros sem expor detalhes internos
- [x] Plugins por IA: catálogo, registro, preferências individuais e autorização nas ferramentas/confirmacões
- [x] Testes automatizados de validação e plugins; limitações de conexões em docs/ai-plugins.md
- Integrações externas pessoais retomadas com autorização do dono para Google Calendar; Gmail e Sheets aguardam validação do Calendar.

- [x] Auditar tabelas, consultas, criação de conta e regras de acesso
- [x] Modelar relacionamento e workspace ativo sem alterar dados existentes
- [x] Criar convite seguro para um único parceiro por workspace
- [x] Vincular o contador ao relacionamento do workspace
- [x] Reforçar isolamento no banco, referências e avatares
- [x] Configurar convite dentro do Life OS e link compartilhável
- [ ] Ativar envio automático por e-mail após configurar o domínio remetente
- [x] Validar usuário isolado, acesso direto, módulos existentes e interface
- [x] Executar compilação e produzir relatório final
- [x] Adicionar menu mobile completo pelo avatar sem alterar a navegação desktop
- [x] Tornar o Life OS AI uma camada global com painel contextual, histórico e atalho Ctrl+J
- [x] Workspace de demonstração marcado só por administrador; preparar/resetar atômicos cobrindo também Compras, Atividades e Rotinas
- [x] Guia da feira em docs/feira-demo.md
- [x] Sincronização segura por workspace (sinais mínimos com RLS; exclusões sem vazar ids)
- [x] Projeto Android (TWA), application ID definitivo com.joaovitorarantes.lifeos, host provisório our-life-flow.lovable.app, guia docs/android-play.md
- [ ] Conta Google Play Console e verificação de identidade (dono)
- [ ] Chave de upload / Play App Signing e SHA-256 no assetlinks.json (dono)
- [ ] Publicar /.well-known/assetlinks.json em our-life-flow.lovable.app (ou no domínio próprio, se confirmado) após obter a SHA-256
- [ ] Conferir login Google/URLs permitidas no host do app e decidir se haverá domínio próprio (dono)
- [ ] Gerar Gradle Wrapper e compilar no Android Studio (JDK 17 + SDK 36) — não executado aqui
- [ ] Criar workspace demo dedicado (SQL de administrador) e testar sincronização em dois aparelhos
- [ ] Ficha da loja, política de privacidade, exclusão de conta e Segurança dos dados
- [ ] Teste fechado (12 testadores por 14 dias, se conta pessoal nova)
- [x] Control Center: Meu espaço (nome, descrição, foto, capa, cor)
- [x] Control Center: Categorias (criar, editar, arquivar, excluir quando seguro)
- [x] Control Center: Pessoas e permissões (workspace_can)
- [x] Control Center: Personalização (navegação, favoritos, tela inicial, preferências)
- [x] Control Center: Dados (exportação do workspace atual, lixeira com restaurar/excluir definitivo confirmado)
- [x] Control Center: Atividade (workspace_activity com metadados mínimos; restauração registrada)
- [x] Registros com deleted_at fora de telas, contagens, dashboards, buscas e cálculos
- [x] Validar integridade dos dados existentes e dos módulos atuais
