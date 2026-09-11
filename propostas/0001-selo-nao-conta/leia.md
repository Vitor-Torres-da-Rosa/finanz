# O aviso da fatura vira etiqueta, em vez de sumir no meio da linha
Hoje o aviso de que um lançamento não entra no total de despesas é emendado
no subtítulo, depois da categoria e da conta. Numa tela de celular a linha
estoura e o aviso é cortado: fica "Outros · C6 Bank · não conta …", que é
justamente a parte que importa sendo escondida.

A proposta tira esse texto do subtítulo e põe embaixo, como etiqueta
discreta, do mesmo jeito que a etiqueta "cai hoje" da lista de clientes.

O que ela NÃO faz: não muda nenhuma conta. O valor, o total de despesas e a
regra de quando um lançamento conta continuam idênticos — é só onde o aviso
aparece.

Risco: baixo. Mexe em uma função de desenho (linhaLancamento) e acrescenta
uma classe de estilo. A suíte inteira passou, 47/47, sem ajuste em teste.

Arquivos: index.html (linhaLancamento e uma regra .etiqueta.fora).
