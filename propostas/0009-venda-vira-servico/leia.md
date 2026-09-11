# Dinheiro de venda entrava no caixa como "Serviços"
Quando um pagamento de cliente é lançado no caixa, a categoria da entrada
estava escrita fixa: "Serviços". Sempre. O registro já sabia se foi venda
ou serviço — o app tinha a informação e jogava fora.

No print, R$ 800,00 de uma TV vendida e R$ 500,00 de uma instalação
elétrica. Antes: "Serviços R$ 1.300,00, 100%". Depois: Venda R$ 800,00 e
Serviços R$ 500,00, que é a mistura real do negócio.

O que a proposta faz: a categoria da entrada passa a vir do tipo do
registro apontado em "Referente a". Venda vira Venda, Outro vira Outros,
Serviço continua Serviços. Tipo que você mesmo criou só vira categoria se
já existir como categoria de entrada — não é papel do pagamento inventar
categoria nova no seu app.

O que ela NÃO faz: nada acontece se o pagamento não apontar um registro em
"Referente a" — sem registro, continua caindo em Serviços, como hoje.

Achado de brinde, que virou item na fila e NÃO está nesta proposta: o campo
"Referente a" vem vazio quando você registra o pagamento direto da ficha,
mesmo que o cliente tenha um único registro em aberto. Por isso o efeito
desta proposta depende de você apontar o registro. Pré-selecionar quando há
só um é outra mudança, com outro risco, e merece proposta própria.

Risco: baixo. Uma função de tradução tipo → categoria, usada num lugar só.

Testes: a suíte deu vermelha numa rodada (t87), o teste passou sozinho e a
rodada completa seguinte fechou 47/47. Vermelho falso de paralelismo, o
mesmo já conhecido. Registro porque aconteceu.

Arquivos: index.html (categoriaDoRegistro nova, usada em abrirFolhaPagamento).
