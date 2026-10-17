# Roadmap

- [x] Fase 2 Ecosystem: adaptadores server-side, seleção explícita, consentimento e credenciais compartilhadas vinculadas ao espaço
- [x] Testes sem credenciais e documentação da configuração segura; credenciais pessoais bloqueadas sem cofre por usuário
- [ ] Verificar provedores em chamadas reais — depende de credenciais compartilhadas configuradas pelo dono e autorização de uso; modo pessoal depende de cofre seguro por usuário

- [x] Retirar apenas o catálogo/plugins adicionados nesta execução; preservar Contextos e histórico de migrations aplicado
- [x] Fase 1 Life AI: inventário revalidado, contratos e despacho tipados compatíveis; sem OAuth, chaves ou novos conectores
- [x] Documentar arquitetura incremental, testes seguros e dependências da Fase 2 em docs/life-ai-phase-1.md
- [ ] Validar Contextos e todos os módulos com sessão autenticada — bloqueado: não há sessão autorizada disponível
- [x] Auditoria estruturada: evidências e riscos documentados em docs/security-functionality-audit.md
- [x] Varredura possível sem sessão: 29 testes, lint direcionado, verificação automática e telas públicas
- [x] Relatório com evidências e limites; nenhuma implementação nova de plugins
- [ ] Endurecer histórico do Life AI e visibilidade de aportes — depende de aprovação das mudanças amplas descritas no relatório

- [x] Corrigir auditoria que bloqueava contextos; validar campos e erros sem expor detalhes internos
- [x] Catálogo novo de plugins retirado; migration 0012 já aplicada preservada, incluindo validação de Contextos
- Integrações externas pessoais pausadas por solicitação do dono; não conectar nem implementar nesta etapa

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
