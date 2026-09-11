# O total do dia somava por um critério, o do período por outro
Na mesma tela de Transações, o número do cabeçalho do dia incluía o
pagamento de fatura, e o total de "Saídas" do período não incluía. Os dois
estavam certos cada um no seu critério, mas juntos se contradiziam: quem
somasse os dias na mão nunca chegava ao total de baixo.

No print, um dia com a fatura de R$ 500,00 paga e um gasto de R$ 120,00. O
cabeçalho dizia −R$ 620,00; passa a dizer −R$ 120,00, que é o que aquele
dia custou de verdade — as compras que formaram a fatura já foram contadas
no mês em que aconteceram.

O que a proposta faz: o total do dia passa a usar a mesma régua do total de
"Saídas" do período.

O que ela NÃO faz: não some com a linha nem muda o valor dela. A fatura
continua listada, com os R$ 500,00, e com o aviso de que não conta como
despesa. (A proposta 0001 deixa esse aviso legível, hoje ele é cortado.)

Risco: baixo. Mexe só na soma do cabeçalho do dia.

Testes: a suíte deu vermelha na primeira rodada (t43, t50, t52, t53), mas
os quatro passaram sozinhos e as duas rodadas completas seguintes fecharam
47/47. Foi o vermelho falso conhecido de rodar doze em paralelo, não a
mudança. Registro porque aconteceu.

Arquivos: index.html (o cálculo de totalDia em Transações).
