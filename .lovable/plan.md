# Casamento — diagnóstico de publicação e Fase 3 (Presentes)

## 1. Diagnóstico de publicação (verificado agora)

- Último commit do branch: `44b1f35` (16:42 UTC, correção da lixeira).
- Última publicação: 16:43:46 UTC, ou seja, **depois** desse commit. O sistema diz que não há mudanças sem publicar.
- Conclusão: **o site de produção já roda o branch atual inteiro**. Isso inclui:
  - Fase 1 do Casamento (b4c4640).
  - Fase 2 (convidados, convites, portal `/convite`, RSVP, check-in: 0950888 / f3eab1b / bfc4539). Antes eu tinha relatado como "não publicada", mas a publicação de 16:43 incluiu essa fase.
  - Notas e recibos (78b8a79).
  - Correção da lixeira (44b1f35).
  - A Faculdade compartilhada (migrations 0018/0019) já estava em commits anteriores e também está no ar.
- As mudanças no banco (migrations 0020–0031) valem para o preview e para a produção desde o momento em que foram aplicadas, porque os dois usam o mesmo backend. Não dependem de publicação.
- Segurança: última verificação sem alertas pendentes (o da lixeira foi corrigido). A verificação do banco é das 16:30 e está marcada como desatualizada. Antes da próxima publicação, recomendo rodar uma nova.
- Build: não há registro de build disponível nesta sessão. Os últimos testes conhecidos foram: tipos OK e 163 testes aprovados (antes da correção da lixeira). A lixeira ainda não foi testada na tela.
- Riscos da Fase 2 já publicada:
  - Até agora existem 0 convidados e 0 convites no espaço real, então nenhum dado de convidado foi exposto.
  - O portal público já responde em produção. Hoje ele só mostra um convite a quem tiver um código válido.
- Publicar de novo agora não levaria nada novo ao ar.

## 2. Escopo da Fase 3 — Presentes e contribuições (sem pagamento online)

Tudo em tabelas `wedding_*`, sem nenhuma ligação com Financeiro, Notas e recibos, Metas, Compras ou o orçamento/despesas do próprio Casamento. A ligação com o orçamento só acontece se o casal pedir depois.

**Painel do casal (`/casamento/presentes`)**
- **Lista de presentes** com três tipos: item físico (com quantidade desejada), fundo livre (valor aberto) e cotas (valor da cota × número de cotas).
- **Para cada presente:** título, descrição, imagem (no armazenamento privado do casamento), link externo opcional, valor sugerido, ordem, visível ou oculto no portal, arquivado.
- **Para cada presente, também:** quantas reservas estão pendentes, confirmadas, canceladas e expiradas, e quanto ainda está disponível.
- **Reservas e intenções:** lista com convite de origem, nome ou "Anônimo", quantidade ou valor, mensagem e estado.
- **Ações do casal:** confirmar recebimento (manual), cancelar com motivo e reabrir. Todas são registradas no histórico, sem dados pessoais.
- **Configuração de Pix e instruções:** só texto exibido (chave escolhida pelo casal, nome do recebedor, instruções). O sistema nunca processa pagamento. Começa vazio.
- **Painel inicial do Casamento:** presentes recebidos e pendentes de confirmação. Só aparece com dados reais.

**Portal do convidado (`/convite/$token`)**
- Seção "Presentes", visível só se o casal ativar.
- O convidado vê os presentes visíveis com a disponibilidade agregada (ex.: "2 de 5 cotas disponíveis"). Nunca vê quem reservou.
- Ele pode reservar um item ou cota, ou declarar a intenção de contribuir, com mensagem curta opcional e a opção de aparecer como anônimo.
- Depois de reservar, vê as instruções de Pix ou de entrega e o estado da reserva: "aguardando confirmação do casal" ou "recebido".
- Pode cancelar a própria reserva pendente. Só enxerga as reservas do próprio convite.

**Regras e segurança**
- Toda ação pública passa por funções `wedding_portal_*` que validam o código do convite no servidor, como na Fase 2. Visitantes não acessam as tabelas.
- Reserva concorrente: o item é travado durante a reserva, e as reservas ativas (pendentes + confirmadas) são contadas. Se passar do limite, a reserva é recusada. Assim, a última cota só pode ser pega uma vez.
- Limites: tamanho da mensagem, número máximo de reservas por convite por hora e valores positivos com teto razoável.
- Reservas pendentes expiram automaticamente no prazo configurado. A expiração é checada quando alguém acessa (sem tarefa agendada).
- "Recebido" só pode ser marcado por um membro do casal.
- Anonimato: o portal nunca mostra nomes de outros convidados. No painel, uma reserva anônima mostra "Anônimo" (ver decisão 4).
- Nenhum dado de cartão ou conta bancária é guardado. Não há checkout nem gateway.
- Migrations só aditivas. Os dados da Fase 1 e da Fase 2 são preservados.

**Tabelas novas (todas com `workspace_id` e acesso por membro do espaço)**
```text
wedding_gifts           tipo (item|fundo|cotas), título, descrição, imagem, link, valor sugerido,
                        valor da cota, quantidade/cotas totais, visível, ordem, arquivado
wedding_gift_pledges    presente, convite, quantidade/cotas, valor, mensagem, anônimo,
                        estado (pendente|confirmado|cancelado|expirado), expira_em,
                        confirmado_por/em, cancelado_por/motivo
wedding_gift_settings   portal ativo, prazo de expiração, edição/cancelamento pelo convidado,
                        Pix: tipo e texto da chave, recebedor, instruções (só exibição)
```

**Aceite**
- Duas reservas simultâneas da última cota: só uma passa.
- Reserva pendente expira ou é cancelada corretamente, e a disponibilidade volta.
- O convite A não vê nem cancela as reservas do convite B. Visitante sem código: nenhum acesso.
- O anonimato é respeitado no portal (e no painel, conforme a decisão).
- Nenhuma linha nova em Financeiro, Notas e recibos, Metas ou despesas do Casamento.
- Telas funcionando em 320/375/768/1024/1440px sem cortes. Fluxo testado com usuário de teste em espaço próprio. Os 15 cômodos e 80 itens do casal ficam intactos.

## 3. Decisões mínimas (com default recomendado)

1. **Tipos de presente:** os três (item físico, fundo livre, cotas). Default: os três ativos.
2. **Valores:** o casal define cada valor. A lista começa vazia, sem sugestões de preço. Default: sem valor mínimo; teto de R$ 50.000 por reserva só como proteção.
3. **Pix:** só texto informativo, preenchido pelo casal. Default: vazio e oculto até ser preenchido. Não vou inventar chave.
4. **Anonimato:** default "anônimo para os outros convidados, mas o casal vê o nome do convite". A alternativa é anonimato total, em que nem o casal vê.
5. **Reserva:** default "o convidado reserva e o casal confirma o recebimento manualmente".
6. **Expiração:** default 7 dias para reservas pendentes. Um fundo livre (sem limite) não expira.
7. **Cancelamento:** default "convidado pode cancelar enquanto estiver pendente; depois de confirmado, só o casal".
8. **Portal:** default seção de Presentes desligada até o casal ativar, mostrando só a disponibilidade agregada.
9. **Entrega de itens físicos:** default "sem endereço no sistema", só um texto de instruções opcional escrito pelo casal.

## Fora do escopo
Checkout, gateway, Stripe/Mercado Pago, cartão, conciliação bancária automática, envio de mensagens, organizadores, Cerimônia/Festa, limpeza de workspaces de teste, publicação.
