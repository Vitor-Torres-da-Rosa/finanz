# A conferência comparava com o banco contando lançamento que ainda não aconteceu
O banco mostra o que já aconteceu. Lançamento com data à frente — aluguel
agendado, parcela combinada para o mês que vem — está certo no app e ainda
não existe no extrato.

A conferência comparava o saldo cheio, com o futuro dentro. A conta não
batia, e logo embaixo havia um botão "Acertar o saldo inicial" oferecendo
consertar isso — mexendo no saldo inicial da conta para compensar dinheiro
que nem saiu. Quem apertasse ficava com o saldo inicial errado para sempre,
e a diferença voltaria a aparecer no mês seguinte, quando a data chegasse.

No print, uma conta com R$ 1.510,00 no total, dos quais R$ 450,00 são um
aluguel agendado para daqui a 20 dias. O banco mostra R$ 1.960,00. Antes, o
campo vinha preenchido com R$ 1.510,00 e "está batendo" era mentira — pondo
os R$ 1.960,00 de verdade, o app acusaria R$ 450,00 de erro. Depois, o
campo já vem com R$ 1.960,00, um aviso em dourado explica o que ficou de
fora, e o saldo cheio continua visível em cima.

O que a proposta faz: a comparação e o "Acertar o saldo inicial" passam a
usar o saldo até hoje. Quando há lançamento à frente, uma linha diz quantos
são, quanto somam e qual saldo está sendo usado na conferência.

O que ela NÃO faz: não esconde nem apaga o lançamento futuro, e não muda o
"Saldo pelo app" que aparece em cima nem o saldo do Início — aqueles
continuam com tudo dentro, que é o certo para planejar.

Risco: baixo, e corrige um caminho que estragava dado. A suíte inteira
passou, 47/47.

Arquivos: index.html (abrirFolhaConferencia).
