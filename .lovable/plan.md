# Isolamento total de workspaces e vínculo de parceiro

## Objetivo
Transformar cada workspace em um universo de dados isolado, mantendo intactas as regras funcionais de Financeiro, Agenda, Contextos, Metas, Nós 2.0 e Acertos.

## Implementação
1. Auditar e reforçar todas as regras de acesso das tabelas diretas e dependentes do workspace, incluindo validações que impeçam referências cruzadas entre entidades de workspaces diferentes.
2. Tornar a criação de conta atômica e independente: perfil, workspace próprio, associação como responsável, categorias iniciais e workspace ativo.
3. Persistir no workspace a configuração do relacionamento, incluindo início e estado; migrar apenas o relacionamento já existente de João e Renifer para 17/09/2023, sem alterar os demais workspaces.
4. Adicionar convites pendentes vinculados ao workspace e ao e-mail, com validade, aceite/recusa e limite de dois membros. O aceite validará a identidade autenticada e definirá o workspace convidado como ativo.
5. Criar em Configurações > Nós a experiência de convidar, acompanhar, aceitar ou recusar; para espaços sem parceiro, substituir o contador por uma chamada apropriada.
6. Enviar o convite também por e-mail usando o domínio próprio do projeto, mantendo o convite disponível dentro do Life OS.
7. Manter avatares pessoais editáveis apenas pelo dono e legíveis apenas por membros do mesmo workspace; manter a foto compartilhada restrita aos membros.
8. Atualizar consultas e mutações para sempre carregar o workspace ativo e usar filtros explícitos, sem mudar cálculos ou comportamentos dos módulos existentes.

## Validação
- Testar com dois usuários e dois workspaces, com dados distintos em despesas, metas, eventos, contextos e relacionamento.
- Tentar leitura, criação, alteração e exclusão direta usando o ID do outro workspace e confirmar bloqueio no banco.
- Confirmar aceite/recusa do convite, limite de dois membros, conta existente e conta nova.
- Confirmar que o contador muda apenas no workspace correspondente e não aparece sem relacionamento.
- Verificar avatares, Financeiro, Agenda, Contextos, Metas, Nós, Acertos, desktop e celular.
- Executar verificação de tipos, build e auditoria de segurança.
