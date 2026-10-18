# Google Calendar pessoal — autorização

## Implementado nesta etapa
- Cliente App User Connector vinculado com acesso offline. Callback do Google: `https://connector-gateway.lovable.dev/api/v1/app-users/oauth2/callback`.
- Configurações → Plugins por IA → Conexões externas → Conectar meu Calendar. Cada pessoa deve estar na própria conta Life OS e autorizar a própria conta Google.
- Popup, troca de código único autenticada, conexão criptografada no servidor, reconexão e desconexão com confirmação. Renovação de tokens pertence ao gateway; tokens Google nunca entram no app.
- Identidade vem da sessão e do perfil ativo; membership é rechecado. Credencial de outro usuário nunca é carregada, e conexão autorizada em outro workspace não é transferida silenciosamente.
- Estado conectado só é mostrado após consulta real de calendarList, com escopos requeridos verificados pelo gateway. Erro de credencial exige reconexão; outros erros não são tratados como credenciais expiradas.
- Calendar continua sem ferramentas de eventos no Life AI; Gmail e Sheets permanecem indisponíveis. Nenhuma escrita no Google foi adicionada.
- Agenda consulta eventos pessoais de todos os calendários acessíveis, expande recorrências pela API e pagina resultados. Não grava eventos no banco do Life OS. Chaves de cache incluem usuário e workspace; escopo ativo e membership são revalidados antes de liberar resultados. Entradas Google são somente leitura, sem formulário local nem arrastar.
- Datas de dia inteiro mantêm fim exclusivo; eventos com horário preservam timestamps e aparecem no fuso do navegador. Mês/semana/dia consultam o período visível; Lista consulta próximos 90 dias. Limites de consulta (50 calendários, 10 páginas por calendário) sinalizam resultado parcial, não alegam cobertura completa.

## Consentimento individual na prévia
1. João entra na própria conta Life OS e abre Agenda → Meu Google Calendar → Conectar meu Calendar.
2. Na janela Google, escolhe a própria conta e autoriza somente leitura do Calendar. Não compartilhar senhas nem copiar códigos para o chat.
3. Volta à Agenda: após salvar autorização, os eventos são consultados automaticamente. Atualizar Calendar permite repetir a leitura. Um calendário sem eventos retorna zero, não exemplos fictícios.
4. Renifer repete na própria sessão Life OS e conta Google. Conta conectada não é herdada pelo parceiro, mesmo no workspace compartilhado.
5. Se o Google bloquear uma conta por modo Testing, o dono do cliente precisa incluí-la como usuário de teste em Google Auth Platform → Audience. Não contornar avisos de segurança do Google.

## Limites e segurança
`features/google-calendar/*.functions.ts` importa helpers somente dentro dos handlers. `app_user_connections` e `app_user_oauth_attempts` têm RLS ativado e grants somente ao servidor privilegiado. A migration é aditiva e não altera registros anteriores.

Gateway valida state/nonce do OAuth Google. O app adiciona tentativa de dez minutos, nonce aleatório armazenado apenas como hash, vínculo de usuário/workspace/produto e consumo condicional único. Retorno público não grava nada; janela original verifica origem, popup, tentativa e nonce antes de enviar código ao servidor. O nonce viaja na query do retorno porque o gateway rejeita fragmentos; não registrar URLs de retorno/query em telemetria. Retorno usa no-store/no-referrer, nenhum recurso externo e limpa a URL imediatamente. O app não registra códigos, credenciais nem conteúdo privado.

Falha após consumir tentativa exige iniciar nova autorização. Se a troca funcionar e a gravação falhar, o app tenta revogar a autorização; falha nessa revogação não é garantia de limpeza. O contrato de exchange documentado retorna credencial e connector_id, não identidade do dono; a associação individual no gateway usa app_user_id e a conclusão segue o padrão oficial com vínculo adicional da tentativa. Não alegar prova criptográfica extra de proprietário retornada pelo exchange.

## Configuração Google
Ativar Google Calendar API; configurar Google Auth Platform; cliente Web; registrar somente o callback acima no Google. Escopos: userinfo.email, userinfo.profile, calendar.readonly (URLs completas no contrato). Inserir Client ID/Secret apenas em App User Connectors, nunca no chat ou código. Acesso offline habilitado. Contas externas em Testing devem ser usuários de teste; autorização expira após sete dias nesse modo. Publicar o OAuth no Google ou usar Internal para organização Workspace é separado de publicar o Life OS.

## Evidência
Teste local com sessão autenticada: catálogo e botão visíveis; início chegou a accounts.google.com. Nenhum consentimento Google foi concluído; salvar/reconectar/revogar e leitura real de calendários de João/Renifer não foram verificados end-to-end. Testes unitários verificam isolamento, expiração/replay, validação, escopos e cifra; não substituem consentimento real.

Agenda autenticada verificada em 18/10/2026: controle desconectado visível e popup chegou ao Google, sem consentimento aceito pelo agente. 53 testes focados passaram; lint direcionado: zero erros, dois avisos preexistentes em views; compilação automática aprovada. Consulta/paginação e datas foram verificadas com respostas simuladas, não com eventos pessoais. Mostrar eventos reais continua dependendo do consentimento de cada pessoa na prévia.

Nenhuma publicação realizada. O site publicado não recebe estes controles até uma publicação futura autorizada. Na prévia, João e Renifer precisam concluir consentimento separadamente para validar o fluxo completo.