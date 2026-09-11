# Os juros de atraso apareciam na parcela e no WhatsApp, mas não no "Falta"
O "Falta" da ficha sai dos registros menos os pagamentos, e juros de atraso
não são registro — são calculados na hora. Resultado: o mesmo cliente tinha
três números diferentes no mesmo app. A ficha dizia R$ 2.000,00, a aba
Parcelas somava R$ 2.100,00 e a mensagem de cobrança no WhatsApp mandava
R$ 2.100,00.

No print, duas parcelas de R$ 1.000,00 vencidas há 3 e 2 meses, a 2% ao
mês: R$ 100,00 de juros que a ficha não mostrava em lugar nenhum.

O que a proposta faz: embaixo do total, quando há juros correndo, uma linha
diz quanto são e quanto o cliente deve com eles. No Empreendedor, a linha
vermelha de clientes em atraso também passa a dizer quanto daquele valor é
juros.

O que ela NÃO faz, de propósito: os juros continuam fora da conta do
"Falta". Somá-los ali mexeria no que o app entende por saldo do cliente, e
é esse número que o "Acertar as parcelas" usa para remontar o plano — juros
entrando ali fariam o app criar parcela de juros sozinho. Preferi mostrar a
juros sem deixá-los mandar no plano.

Risco: baixo. Duas linhas de texto e um campo novo no resumo geral; nenhuma
conta existente mudou. A suíte inteira passou, 47/47.

Arquivos: index.html (montarFichaCliente, desenharEmpreendedor e
resumoGeralClientes).
