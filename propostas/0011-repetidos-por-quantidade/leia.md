# Importar sumia com transação de verdade quando havia duas iguais
O app marcava um lançamento do extrato como repetido se existisse qualquer
outro igual na conta — bastava existir um. Só que "repetido" é questão de
quantidade, não de existir: dois Pix de R$ 50,00 no mesmo dia são duas
coisas diferentes.

No print, a conta tem um Pix de R$ 50,00 do dia 8 e o extrato traz dois,
porque foram dois mesmo. Antes o app desmarcava os dois e importava 1 de 3
lançamentos, R$ 120,00 — o segundo Pix simplesmente sumia, e o saldo ficava
R$ 50,00 acima do banco sem explicação. Depois: um marcado como "já
existe", o outro entra, 2 de 3 lançamentos, R$ 170,00.

O que a proposta faz: cada linha do arquivo consome uma das cópias que a
conta já tem. Com uma na conta e duas no extrato, a primeira é repetida e a
segunda é nova. Com duas na conta e duas no extrato, as duas continuam
desmarcadas, como hoje.

O que ela NÃO faz: não muda o critério de igualdade (mesma data, mesmo
valor, mesmo tipo) nem importa nada sozinho — as marcações continuam
sugestão, e você pode desmarcar na mão.

Risco: médio-baixo. Mexe na importação, que é por onde entram os dados de
verdade. O erro que ela corrige era para menos (sumia transação); errar
para mais criaria duplicata, então olhe a lista antes de lançar, como já é
o hábito. A suíte inteira passou, 47/47.

Arquivos: index.html (jaTemIgual virou chaveDoIgual + quantosJaTem, e o
laço que marca os itens em mostrarExtrato).
