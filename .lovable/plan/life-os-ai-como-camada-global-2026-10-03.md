# Life OS AI como camada global

## Resultado
Manter “Falar com o Life OS” como central completa e adicionar o mesmo agente como presença persistente em todas as telas autenticadas, sem trocar de página.

## Implementação
- Criar um host global único no contêiner principal do app, compartilhando conversas, histórico, ferramentas, permissões e confirmações já existentes.
- Adicionar o botão exclusivo `✦ Life AI`: discreto no canto inferior direito no desktop/tablet e acima da navegação inferior no celular, respeitando a área segura.
- Abrir um painel lateral no desktop/tablet e uma folha expandida no celular, com nova conversa, conversas recentes e acesso à central completa.
- Reutilizar o chat e a lista de conversas atuais; o botão “+”, a busca `Ctrl + K` e a rota `/inbox` permanecem intactos.
- Adicionar `Ctrl + J`, fechamento por `Esc`, foco correto, tooltip e animação curta com redução de movimento.
- Enviar ao mesmo agente o contexto da tela atual como auxílio interno, sem limitar consultas ou permissões e sem fazer consultas apenas ao abrir o painel.

## Detalhes técnicos
- O painel manterá uma única instância montada no shell autenticado, evitando duplicação por página.
- O contexto incluirá rota, módulo e identificador visível quando a rota representar um item específico; o servidor continuará derivando workspace e autorização da conversa.
- Nenhuma alteração em banco, RLS, dados, workspaces, ferramentas do agente ou regras de execução.

## Verificação
- Validar abertura, envio, histórico, nova conversa, confirmação e fechamento sem sair da tela atual.
- Conferir navegação entre módulos com o botão persistente e testar os tamanhos solicitados de 320 px a 1920 px, incluindo ausência de sobreposição e overflow.
