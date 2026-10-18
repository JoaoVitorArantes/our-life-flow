# Google Calendar pessoal — autorização

## Implementado nesta etapa
- Cliente App User Connector vinculado com acesso offline. Callback do Google: `https://connector-gateway.lovable.dev/api/v1/app-users/oauth2/callback`.
- Configurações → Plugins por IA → Conexões externas → Conectar meu Calendar. Cada pessoa deve estar na própria conta Life OS e autorizar a própria conta Google.
- Popup, troca de código único autenticada, conexão criptografada no servidor, reconexão e desconexão com confirmação. Renovação de tokens pertence ao gateway; tokens Google nunca entram no app.
- Identidade vem da sessão e do perfil ativo; membership é rechecado. Credencial de outro usuário nunca é carregada, e conexão autorizada em outro workspace não é transferida silenciosamente.
- Estado conectado só é mostrado após consulta real de calendarList, com escopos requeridos verificados pelo gateway. Erro de credencial exige reconexão; outros erros não são tratados como credenciais expiradas.
- Calendar continua sem ferramentas de eventos no Life AI; Gmail e Sheets permanecem indisponíveis. Nenhuma escrita no Google foi adicionada.

## Limites e segurança
`features/google-calendar/*.functions.ts` importa helpers somente dentro dos handlers. `app_user_connections` e `app_user_oauth_attempts` têm RLS ativado e grants somente ao servidor privilegiado. A migration é aditiva e não altera registros anteriores.

Gateway valida state/nonce do OAuth Google. O app adiciona tentativa de dez minutos, nonce aleatório armazenado apenas como hash, vínculo de usuário/workspace/produto e consumo condicional único. Retorno público não grava nada; janela original verifica origem, popup, tentativa e nonce antes de enviar código ao servidor. O nonce viaja na query do retorno porque o gateway rejeita fragmentos; não registrar URLs de retorno/query em telemetria. Retorno usa no-store/no-referrer, nenhum recurso externo e limpa a URL imediatamente. O app não registra códigos, credenciais nem conteúdo privado.

Falha após consumir tentativa exige iniciar nova autorização. Se a troca funcionar e a gravação falhar, o app tenta revogar a autorização; falha nessa revogação não é garantia de limpeza. O contrato de exchange documentado retorna credencial e connector_id, não identidade do dono; a associação individual no gateway usa app_user_id e a conclusão segue o padrão oficial com vínculo adicional da tentativa. Não alegar prova criptográfica extra de proprietário retornada pelo exchange.

## Configuração Google
Ativar Google Calendar API; configurar Google Auth Platform; cliente Web; registrar somente o callback acima no Google. Escopos: userinfo.email, userinfo.profile, calendar.readonly (URLs completas no contrato). Inserir Client ID/Secret apenas em App User Connectors, nunca no chat ou código. Acesso offline habilitado. Contas externas em Testing devem ser usuários de teste; autorização expira após sete dias nesse modo. Publicar o OAuth no Google ou usar Internal para organização Workspace é separado de publicar o Life OS.

## Evidência
Teste local com sessão autenticada: catálogo e botão visíveis; início chegou a accounts.google.com. Nenhum consentimento Google foi concluído; salvar/reconectar/revogar e leitura real de calendários de João/Renifer não foram verificados end-to-end. Testes unitários verificam isolamento, expiração/replay, validação, escopos e cifra; não substituem consentimento real.

Nenhuma publicação realizada. O site publicado não recebe estes controles até uma publicação futura autorizada. Na prévia, João e Renifer precisam concluir consentimento separadamente para validar o fluxo completo.