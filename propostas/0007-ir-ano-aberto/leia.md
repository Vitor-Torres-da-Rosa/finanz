# O relatório de IR afirmava a posição de 31/12 com o ano ainda correndo
Abrindo o relatório em setembro, ele dizia "Posição em 31/12/2026" e
"Em 31/12/2026: R$ 16.420,00". Mas 31/12/2026 não chegou — aquele número é
o de hoje, com o rótulo de dezembro em cima. O app estava afirmando uma
coisa que ainda não aconteceu, na tela que existe justamente para você
copiar número para a declaração.

O que a proposta faz: enquanto o ano não fecha, o título e a coluna passam
a dizer "Hoje, 11/09/2026", a linha vira "Total hoje", a variação vira
"Variação no ano até aqui", e um aviso explica que a declaração pede a
posição do último dia do ano — volte em janeiro. Com o ano fechado (você
abrindo em 2027 o relatório de 2026), nada muda: continua "Em 31/12/2026".

O que ela NÃO faz: não muda valor nenhum. Os R$ 16.420,00 continuam
R$ 16.420,00 — o que muda é o app parar de chamá-los de saldo de dezembro.

Risco: baixo. Mexe em rótulo e numa data de corte que já era calculada. A
suíte inteira passou, 47/47.

Observação: mexe no mesmo bloco da proposta 0005. As duas juntas dão
conflito de texto na hora de juntar, que eu resolvo mantendo as duas
intenções. Aceitar só uma funciona normalmente.

Arquivos: index.html (o bloco tipo === 'ir' em abrirRelatorio).
