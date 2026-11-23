# "Ajustar saldo" contava lançamento que ainda não aconteceu
O "Ajustar saldo" da 5.92 compara o que você digita com o saldo da conta. Só
que esse saldo tinha o futuro dentro: aluguel agendado, parcela do mês que
vem. O banco ainda não viu esse dinheiro sair.

No print, a conta tem R$ 1.880,00 hoje e um aluguel de R$ 450,00 agendado
para daqui a 20 dias. O banco mostra R$ 1.880,00. Antes, o app dizia
"R$ 450,00 a mais do que o app mostra" e oferecia lançar uma receita de
R$ 450,00 ou subir o saldo inicial em R$ 450,00. Qualquer uma das duas
estraga a conta: quando o aluguel chegasse, ela ficaria R$ 450,00 acima do
banco. É o mesmo erro que a 0012 conserta na conferência.

O que a proposta faz: o ajuste compara com o saldo de hoje. Quando há
lançamento à frente, uma linha em dourado diz quantos são, quanto somam e
como a conta fica com eles.

O que ela NÃO faz: não muda o saldo do Início nem o "Saldo atual" da conta,
que continuam com tudo dentro. Não esconde nem apaga o lançamento futuro.

Risco: baixo. A conta só muda quando há lançamento com data à frente, e
corrige um caminho que estragava o saldo inicial. Teste novo: t185.

Arquivos: index.html (abrirAjusteDeSaldo), testes/casos/t185.mjs.
