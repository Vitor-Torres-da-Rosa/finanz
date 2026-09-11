# O "Referente a" nascia vazio mesmo com um registro só
Registrando o pagamento direto da ficha do cliente, o campo "Referente a"
vinha em "Sem registro específico" — mesmo quando o cliente tem um único
registro e não há o que escolher. Um toque a mais toda vez, e quem esquece
fica com o pagamento solto, sem saber a que venda ou serviço ele se refere.

O que a proposta faz: com um registro só, ele já vem apontado. Com dois ou
mais, continua vazio — o app não chuta, porque errar o registro bagunça a
conta do cliente.

Registros de acréscimo que o próprio app criou (do parcelamento) não contam
para esse "um só": eles existem por causa de outro registro, não são o que
o cliente comprou. Então um cliente com "TV" e "Acréscimo do parcelamento
em 4x" continua apontando para a TV.

O que ela NÃO faz: não mexe em valor, em parcela nem em pagamento já
gravado. É só o valor inicial de um campo.

Combina com a 0009 (a que faz venda entrar como Venda no caixa): aquela só
tem efeito quando o registro está apontado, e esta faz o apontamento
acontecer sozinho no caso mais comum. Aceitar as duas juntas fecha o
caminho; aceitar só uma funciona, cada uma pela metade.

Risco: baixo. Muda o valor padrão de um seletor. A suíte inteira passou,
47/47.

Arquivos: index.html (abrirFolhaPagamento).
