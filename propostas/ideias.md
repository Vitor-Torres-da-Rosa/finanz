# Fila de ideias

O que a `/melhorar` pega quando roda sozinha, de cima para baixo. Item que
virou proposta ganha `[proposto NNNN]`. Recusado ganha `[recusado]` com o
motivo, para não voltar.

## Achado na auditoria

Varri as cinco telas com dados de borda (valor zero, meta sem alvo, ativo
sem aporte, conta sem lançamento, orçamento zerado) procurando NaN,
Infinity, undefined e percentual absurdo: nada. O app aguenta bem esses
casos, e não há erro de console.

- [proposto 0007] O relatório de IR afirmava "Posição em 31/12" com o ano
  ainda correndo, mostrando o valor de hoje sob o rótulo de dezembro.
- [proposto 0012] A conferência com o banco somava lançamentos com data
  futura e oferecia "Acertar o saldo inicial" em cima dessa diferença
  falsa, estragando o saldo inicial da conta.
- [proposto 0011] Na importação, dois lançamentos iguais no mesmo dia eram
  todos marcados como repetidos: bastava existir um igual na conta. Sumia
  transação de verdade.
- [proposto 0009] O pagamento de cliente lançado no caixa entrava sempre na
  categoria "Serviços", mesmo vindo de uma venda.
- [proposto 0010] Registrando o pagamento direto da ficha, o campo
  "Referente a" vem vazio
  mesmo quando o cliente tem um único registro em aberto. Podia já vir
  apontado — amarra o pagamento ao registro e faz a categoria sair certa
  sozinha. Mexe em mais coisa que a 0009, então merece proposta própria.
- [proposto 0008] Os juros de atraso apareciam na parcela e na mensagem do
  WhatsApp, mas não no "Falta" da ficha nem no resumo geral.
- abaterSobra marcava as parcelas cobertas pela sobra com a data de hoje,
  não com a data do pagamento: registrar no dia 11 um pagamento recebido no
  dia 5 gravava "quitada em 11". Corrigi e testei — mas as parcelas
  quitadas saem da lista logo em seguida, então a diferença não aparece em
  print nenhum. Sem antes e depois para o Vitor ver, não vira proposta:
  fica aqui para pegar carona na próxima mudança que toque essa área.
- A ordenação do histórico de ativos depende do relógio do aparelho:
  valorAtivoEm percorre o array na ordem em que está e pega o último item
  com data <= o corte. O array é ordenado ao carregar (backup e servidor) e
  os acréscimos usam sempre a data de hoje, então na prática fica ordenado.
  Só quebra se o relógio do celular estiver atrasado. Baixíssima
  prioridade, mas fica anotado.

## Achado de verdade, sem print que mostre

- **Renomear ou excluir um tipo de registro não alcança os orçamentos.**
  `editarTipoRegistro` (index.html) atualiza `estado.tiposRegistro` e
  `estado.servicos`, mas nunca `estado.propostas` — e o orçamento guarda o
  tipo no campo "O que é" (`alvo.tipo = rascunho.tipo`, e ele aparece no
  cabeçalho do orçamento e no PDF que vai para o cliente). Renomeando
  "Locação" para "Aluguel", o orçamento salvo continua dizendo "Locação";
  excluindo o tipo, ele fica apontando para um tipo que não existe mais. A
  contagem do aviso de exclusão ("Os N registro(s)...") também ignora os
  orçamentos, então subestima o estrago.

  A correção é de três linhas e eu a escrevi e testei (47/47). O que me fez
  jogar fora foi o print: o passo de renomear passa por três folhas
  aninhadas e o cenário não conseguiu executá-lo, então o "depois" saiu
  igual ao "antes" duas vezes. Sem antes e depois, o Vitor não tem como
  julgar, e a regra é dele. Fica aqui para ser feito com ele olhando.

## Bug que dá número errado

- [proposto 0002] A dívida de cartões só cresce. `dividaDeCartoes` soma toda saída lançada
  no cartão e nunca desconta o pagamento da fatura, porque a importação
  registra esse pagamento como saída da conta corrente e não como
  transferência para o cartão. Quem usa cartão vê uma dívida que não para
  de subir.
- [proposto 0003] Em Transações o total do dia soma a fatura paga, mas o total de "Saídas"
  do período não. As duas contas estão certas cada uma no seu critério, mas
  na mesma tela isso confunde: falta dizer qual é qual.

## Falta funcionalidade

- Não dá para marcar uma parcela como perdoada ou renegociada: ou ela é
  paga, ou fica devendo para sempre. **Não cabe numa proposta**: precisa de
  coluna nova no banco e de migração que o Vitor tem que rodar à mão, e
  proposta é coisa que ele aceita só pelo número. Assunto para uma conversa
  com ele, não para uma passada sozinho.
- [proposto 0004] Orçamento por categoria não avisa quando estoura — só
  mostra a barra.
- [proposto 0005] O relatório de IR existe, mas não separa o que é
  dedutível.

## Acabamento

- [proposto 0001] O lançamento que não conta como despesa é marcado com
  texto corrido no subtítulo; junto com o resto da linha vira uma frase só.
- [proposto 0006] No orçamento por categoria, a que estourou fica perdida
  na ordem alfabética; podia subir para o topo, como o cliente atrasado
  sobe na lista de clientes.

## Lançadas na 5.5.0

As de número 0001, 0002, 0004, 0005, 0006, 0007, 0009 e 0010 foram aceitas
pelo Vitor em 13/09/2026 e estão no ar. Não voltam para a fila.

Na 0010 ele pediu mais do que o print mostrava: o "Referente a" da folha de
parcelamento também aponta sozinho, mas só quando sobra um registro sem
parcela combinada. Com dois em aberto, quem escolhe é ele. Foi feito junto.

## Paradas, não descartadas

Estas quatro foram mostradas com print e ele não as escolheu nesta rodada.
Não apaguei: as quatro são erro de número ou de dado, que é a classe mais
alta da fila, e jogar fora conserto de conta errada é diferente de jogar
fora recurso que ele não quer. Ficam de pé, com ramo e pasta, prontas para
ele aceitar quando quiser. Não propor de novo por conta própria.

- [parada 0003] O total do dia conta o pagamento de fatura duas vezes:
  −R$ 620,00 no dia contra −R$ 120,00 no período, na mesma tela.
- [parada 0008] Juros de atraso não entram no "Falta" do cliente:
  R$ 2.000,00 mostrados contra R$ 2.100,00 devidos.
- [parada 0011] Importar extrato some com transação repetida no mesmo dia:
  três compras iguais entram como uma.
- [parada 0012] Conferir saldo conta lançamento futuro e oferece ajustar o
  saldo inicial para um valor errado.

## Achado sem reprodução firme

- Uma vez, no t91, a transferência recém-juntada apareceu como "— → —" no
  lugar das contas: o lançamento existia com o valor certo e sem contaId.
  Não repetiu em três execuções seguidas nem na versão anterior, então é
  corrida entre gravar e sincronizar, não a mudança daquele dia. Se voltar,
  olhar a ordem de nuvemEnviar/nuvemBaixar em aplicarTransferencias.

## Ideias que não existiam

Estas eu tinha escrito de memória e fui conferir no código: são falsas.
Fica o registro para eu não voltar a propor, e a lição de semear a fila
com o que foi visto, não com o que foi lembrado.

- [falsa] "Estado vazio de Investimentos não tem botão." Tem: o botão
  "Cadastrar primeiro ativo" já está lá.
- [falsa] "Nome longo corta sem reticência nos cartões de conta." A regra
  .linha-titulo já tem text-overflow: ellipsis.
