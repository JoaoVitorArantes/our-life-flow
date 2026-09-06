# Foto compartilhada do workspace

## Objetivo
Substituir o bloco “L” da barra lateral por uma foto do Life OS compartilhada: qualquer membro do mesmo workspace poderá trocar ou remover a imagem, e a mudança aparecerá para o casal.

## Implementação
- Adicionar um campo de imagem ao workspace, sem alterar nome, membros ou demais dados.
- Guardar a imagem no bucket privado já existente, em uma pasta própria do workspace.
- Acrescentar permissões restritas para que somente membros daquele workspace possam visualizar, enviar, substituir ou remover a imagem compartilhada.
- Criar um seletor com prévia, recorte quadrado, compressão, confirmação e remoção.
- Exibir a foto no lugar do “L”, mantendo “L” como fallback quando nenhuma imagem estiver definida.
- Atualizar os dados do workspace imediatamente após salvar/remover para refletir a mudança para os dois usuários.

## Validação
- Confirmar que o projeto compila sem erros.
- Testar com sessão autenticada que a imagem pode ser trocada/removida e reaparece após recarregar.
- Confirmar que caminhos de outros workspaces não podem ser alterados.

## Detalhes técnicos
A alteração de acesso será limitada aos arquivos em `workspaces/{workspaceId}/...` no bucket privado de avatares. As regras atuais de perfil, Financeiro, Agenda, Nós, Contextos, Metas, Acertos e associação ao workspace permanecerão intactas.
