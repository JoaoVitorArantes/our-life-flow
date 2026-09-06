# Menu mobile completo do Life OS

## Objetivo
Manter a barra inferior como navegação rápida e transformar o avatar do cabeçalho mobile na entrada para um painel completo, sem alterar o desktop nem qualquer regra de negócio.

## Implementação
- Criar um drawer lateral mobile com perfil no topo, nome do workspace e acesso à troca da foto existente.
- Reutilizar `NAV_GROUPS` e `FOOTER_NAV` para garantir as mesmas rotas, grupos e ícones do sidebar desktop, sem duplicar a arquitetura de navegação.
- Extrair o cálculo dos badges reais para um hook compartilhado entre sidebar e menu mobile, preservando Agenda, Tarefas, Financeiro e Metas.
- Destacar a rota atual e fechar o drawer automaticamente ao navegar, usando a navegação interna existente para preservar estado e evitar recarga.
- Manter troca de tema, configurações e saída no painel; preservar o menu de perfil desktop atual.
- Garantir rolagem, áreas de toque de no mínimo 44px e safe areas no modo instalado.

## Arquivos previstos
- Novo componente do menu mobile em `src/components/layout/`.
- Novo hook compartilhado de indicadores em `src/features/app/`.
- Ajustes pontuais em `header.tsx`, `sidebar.tsx` e `avatar-menu.tsx` para conectar o novo painel sem alterar desktop.

## Validação
- Verificar todas as 12 rotas pelo menu, fechamento automático, destaque ativo e badges reais.
- Confirmar a barra inferior e o botão `+` com as sete ações solicitadas.
- Testar viewport pequeno em temas escuro e claro.
- Conferir desktop, TypeScript, build e erros no navegador.
