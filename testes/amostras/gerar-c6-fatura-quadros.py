# Fatura do C6 de verdade, copiada dos prints do Vitor (18/11/2026), com
# todos os quadros que NAO sao compra: opcoes de pagamento, parcelamento
# com CET, encargos, resumo, limite, Pix e boleto. A data da compra vem
# grudada na loja ("06 dezMERCADOLIVRE"), como sai do texto do PDF real.
# So a pagina de transacoes tem compras: 5, somando R$ 2.462,35. O
# "Pag Fatura Boleto" e o pagamento da fatura passada. Gera
# c6-fatura-quadros.pdf (nome trocado).
paginas = []
cab = [
    (800, [(40, 'F2', 'C6 BANK'), (160, 'F1', 'Vencimento: 10 de Novembro'), (330, 'F1', 'Debito automatico: Ativado'), (450, 'F1', 'FULANO DE TAL')]),
    (786, [(160, 'F1', 'Valor da fatura: R$ 2.462,35'), (330, 'F1', 'Anuidade: R$0,00'), (450, 'F1', 'Cartao C6 Platinum')]),
    (772, [(160, 'F1', 'Melhor dia de compra: 4')]),
]
# 1/7
paginas.append([
    (800, [(40, 'F2', 'C6 BANK'), (120, 'F1', 'mastercard')]),
    (760, [(40, 'F1', 'Ola, FULANO! Sua fatura com vencimento em Novembro chegou no valor de R$ 2.462,35.')]),
    (740, [(40, 'F1', 'Data do vencimento: 10 de Novembro')]),
    (726, [(40, 'F1', 'Limite total: R$ 4.748,87')]),
    (690, [(40, 'F2', 'Opcoes de pagamento')]),
    (676, [(40, 'F1', '1. Pagamento total'), (120, 'F1', 'Recomendado'), (200, 'F1', '2. Pagamento minimo ou parcial'), (380, 'F1', '3. Parcelamento em 3x')]),
    (662, [(40, 'F1', 'R$ 2.462,35'), (200, 'F1', 'A partir de R$ 369,35'), (380, 'F1', 'Entrada + 2x de R$ 861,34')]),
    (630, [(40, 'F2', 'Pague com Pix e libere seu limite em minutos'), (400, 'F1', 'Valor da fatura:')]),
    (616, [(40, 'F1', 'E so escanear o QR Code usando o app de qualquer banco para'), (400, 'F1', 'R$ 2.462,35')]),
    (602, [(40, 'F1', 'pagar com Pix.'), (400, 'F1', 'Vencimento:')]),
    (588, [(400, 'F1', '10/11/2026')]),
    (560, [(40, 'F1', '1 / 7')]),
])
# 2/7
paginas.append(cab + [
    (740, [(40, 'F2', 'Pagamento de fatura')]),
    (710, [(40, 'F1', '1. Pagamento total'), (120, 'F1', 'Recomendado'), (480, 'F1', 'R$ 2.462,35')]),
    (690, [(40, 'F1', '2. Parcelamento de fatura'), (400, 'F1', 'Em ate 33x de R$140,59')]),
    (670, [(40, 'F1', 'Parcelamento'), (150, 'F1', 'Total a pagar'), (230, 'F1', 'CET'), (300, 'F1', 'Juros do parcelamento em 33x'), (420, 'F1', '4,49% a.m.'), (480, 'F1', '70,64% a.a.')]),
    (656, [(40, 'F1', 'Entrada + 2x de R$ 861,34'), (150, 'F1', 'R$ 2.584,02'), (230, 'F1', '81,59% a.a.'), (300, 'F1', 'CET do financiamento'), (420, 'F1', '5,16% a.m.'), (480, 'F1', '84,42% a.a.')]),
    (642, [(40, 'F1', 'Entrada + 5x de R$ 461,05'), (150, 'F1', 'R$ 2.766,30'), (230, 'F1', '79,09% a.a.'), (300, 'F1', 'IOF do parcelamento'), (420, 'F1', '0,38% + 0,0082% (a.d)')]),
    (628, [(40, 'F1', 'Entrada + 7x de R$ 361,51'), (150, 'F1', 'R$ 2.892,08'), (230, 'F1', '78,59% a.a.')]),
    (614, [(40, 'F1', 'Entrada + 9x de R$ 302,18'), (150, 'F1', 'R$ 3.021,80'), (230, 'F1', '78,37% a.a.')]),
    (600, [(40, 'F1', 'Entrada + 11x de R$ 262,95'), (150, 'F1', 'R$ 3.155,40'), (230, 'F1', '78,31% a.a.')]),
    (570, [(40, 'F1', '3. Pagamento minimo'), (480, 'F1', 'R$ 369,35')]),
    (550, [(40, 'F1', 'Gastos desta fatura'), (220, 'F1', 'R$ 369,35'), (300, 'F1', 'Juros Rotativo'), (420, 'F1', '19,00% a.m. 730,15% a.a.')]),
    (536, [(40, 'F1', 'Saldo rotativo'), (220, 'F1', 'R$ 0,00'), (300, 'F1', 'CET do financiamento'), (420, 'F1', '19,63% a.m. 784,87% a.a.')]),
    (522, [(40, 'F1', 'Encargos do credito rotativo'), (220, 'F1', 'R$ 0,00'), (300, 'F1', 'Encargos e IOF do rotativo'), (480, 'F1', 'R$ 410,77')]),
    (508, [(40, 'F1', 'Encargos de atraso'), (220, 'F1', 'R$ 0,00'), (300, 'F1', 'IOF do rotativo'), (420, 'F1', '0,38% + 0,0082% (a.d)')]),
    (494, [(40, 'F1', 'Pagamento minimo obrigatorio'), (220, 'F1', 'R$ 369,35')]),
    (460, [(40, 'F1', '2 / 7')]),
])
# 3/7
paginas.append(cab + [
    (740, [(40, 'F2', 'Pagamento de fatura')]),
    (710, [(40, 'F1', '4. Atrasar ou pagar menos que o minimo da fatura'), (300, 'F1', 'Nao recomendado')]),
    (690, [(40, 'F1', 'Juros do rotativo'), (180, 'F1', '19,00% a. 730,15% a.'), (300, 'F1', 'Juros maximo do contrato'), (480, 'F1', '27,00% a.m.')]),
    (676, [(40, 'F1', 'Juros de mora por atraso - % a.m.'), (240, 'F1', '1,00%')]),
    (662, [(40, 'F1', 'Multa por atraso'), (240, 'F1', '2,00%'), (300, 'F1', 'Juros do financiamento pos-rotativo'), (450, 'F1', '5,99% a.m. 102,95% a.')]),
    (648, [(40, 'F1', 'IOF de financiamento - % a.m.'), (180, 'F1', '0,38% + 0,0082% (a.d)'), (300, 'F1', 'CET do financiamento'), (450, 'F1', '6,62% a.m. 118,23% a.')]),
    (634, [(300, 'F1', 'IOF do atraso'), (450, 'F1', '0,38% + 0,0082% (a.d)')]),
    (600, [(40, 'F1', '3 / 7')]),
])
# 5/7
paginas.append(cab + [
    (740, [(40, 'F2', 'Resumo da fatura')]),
    (726, [(40, 'F1', 'Compras e pagamentos feitos ate o fechamento desta fatura em 03/11/26.')]),
    (700, [(40, 'F1', 'Compras nacionais'), (480, 'F1', '2.462,35')]),
    (686, [(40, 'F1', 'Compras internacionais'), (480, 'F1', '0,00')]),
    (672, [(40, 'F1', 'Anuidade diferenciada'), (480, 'F1', '0,00')]),
    (658, [(40, 'F1', 'Juros de financiamento'), (480, 'F1', '0,00')]),
    (630, [(40, 'F2', 'Total a pagar'), (460, 'F2', 'R$ 2.462,35')]),
    (616, [(40, 'F1', 'Saldo obrigacoes futuras'), (460, 'F1', 'R$ 4.749,00')]),
    (590, [(40, 'F1', 'Total'), (120, 'F1', 'Utilizado'), (200, 'F1', 'Disponivel')]),
    (576, [(40, 'F1', 'R$7.211,22'), (120, 'F1', 'R$7.211,35'), (200, 'F1', 'R$-0,13'), (300, 'F1', 'R$721,12'), (380, 'F1', 'R$0,00'), (460, 'F1', 'R$721,12')]),
    (540, [(40, 'F1', '5 / 7')]),
])
# 6/7: as compras
paginas.append(cab + [
    (740, [(40, 'F2', 'Transacoes do cartao principal')]),
    (726, [(40, 'F1', 'Lembrando: nesta fatura serao lancadas apenas transacoes feitas ate 03/11/26.')]),
    (700, [(40, 'F2', 'C6 Carbon Virtual Final 6674 - FULANO DE TAL'), (280, 'F1', 'Cartao Virtual'), (380, 'F1', 'Subtotal deste cartao R$ 281,80')]),
    (686, [(480, 'F1', 'Valores em reais')]),
    (670, [(50, 'F1', '06 dezMERCADOLIVRE*MERCADOL - '), (225, 'F2', 'Parcela 11/12'), (520, 'F1', '141,58')]),
    (656, [(50, 'F1', '04 janHAVAN VIAMAO - '), (180, 'F2', 'Parcela 10/10'), (527, 'F1', '59,99')]),
    (642, [(50, 'F1', '04 abrZP *WEBER MOTO PECAS L - '), (230, 'F2', 'Parcela 7/12'), (527, 'F1', '28,62')]),
    (628, [(50, 'F1', '21 abrSHOPEE *CESARIPNEUSF - '), (215, 'F2', 'Parcela 7/9'), (527, 'F1', '51,61')]),
    (600, [(40, 'F2', 'C6 Platinum Final 9534 - FULANO DE TAL'), (380, 'F1', 'Subtotal deste cartao R$ 2.180,55')]),
    (584, [(50, 'F1', '16 julJIM.COM* FULANO DE TAL - '), (225, 'F2', 'Parcela 4/6'), (510, 'F1', '2.180,55')]),
    (570, [(50, 'F1', '13 outPag Fatura Boleto'), (510, 'F1', '2.562,34')]),
    (540, [(40, 'F1', '6 / 7')]),
])
# 7/7: Pix e boleto
paginas.append(cab + [
    (740, [(40, 'F2', 'Formas de pagamento')]),
    (710, [(40, 'F2', 'Pague com Pix e libere seu limite em minutos'), (400, 'F1', 'Valor da fatura:')]),
    (696, [(40, 'F1', 'E so escanear o QR Code usando o app de qualquer banco para pagar'), (400, 'F1', 'R$ 2.462,35')]),
    (682, [(400, 'F1', 'Vencimento:')]),
    (668, [(400, 'F1', '10/11/2026')]),
    (640, [(40, 'F1', 'C6 BANK 336'), (400, 'F2', 'Recibo do pagador')]),
    (626, [(40, 'F1', 'NUMERO DO CARTAO'), (200, 'F1', 'NOSSO NUMERO'), (380, 'F1', 'VENCIMENTO')]),
    (612, [(40, 'F1', '3134'), (200, 'F1', '349536270'), (380, 'F1', '10/11/2026')]),
    (598, [(40, 'F1', 'VALOR TOTAL'), (200, 'F1', 'PAGAMENTO MINIMO'), (380, 'F1', 'VALOR PAGO R$')]),
    (584, [(40, 'F1', '2.462,35'), (200, 'F1', '369,35')]),
    (560, [(40, 'F1', 'DATA DO DOCUMENTO'), (130, 'F1', 'N. DO DOCUMENTO'), (230, 'F1', 'DATA DO PROCESSAMENTO')]),
    (546, [(40, 'F1', '18/11/2026'), (130, 'F1', '3099125463'), (230, 'F1', '03/11/2026'), (460, 'F1', '349536270')]),
    (532, [(40, 'F1', 'USO DO BANCO'), (130, 'F1', 'CARTEIRA'), (180, 'F1', 'ESPECIE'), (260, 'F1', 'VALOR'), (430, 'F1', '(=) VALOR TOTAL DO DOCUMENTO')]),
    (518, [(130, 'F1', '29'), (180, 'F1', 'R$'), (260, 'F1', '2.462,35'), (480, 'F1', '2.462,35')]),
    (490, [(40, 'F1', '7 / 7')]),
])

def esc(t): return t.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')
objs = [b'<< /Type /Catalog /Pages 2 0 R >>', None]
kids = []
fontes = len(objs) + 1
objs.append(b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
objs.append(b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
for linhas in paginas:
    corpo = []
    for y, partes in linhas:
        for x, f, t in partes:
            corpo.append('BT /%s 9 Tf %d %d Td (%s) Tj ET' % (f, x, y, esc(t)))
    stream = '\n'.join(corpo).encode('latin-1')
    objs.append(b'<< /Length %d >>\nstream\n' % len(stream) + stream + b'\nendstream')
    conteudo = len(objs)
    objs.append(b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 %d 0 R /F2 %d 0 R >> >> /Contents %d 0 R >>' % (fontes, fontes + 1, conteudo))
    kids.append(len(objs))
objs[1] = b'<< /Type /Pages /Kids [' + b' '.join(b'%d 0 R' % k for k in kids) + b'] /Count %d >>' % len(kids)
out = bytearray(b'%PDF-1.4\n')
pos = []
for i, o in enumerate(objs, 1):
    pos.append(len(out))
    out += b'%d 0 obj\n' % i + o + b'\nendobj\n'
xref = len(out)
out += b'xref\n0 %d\n0000000000 65535 f \n' % (len(objs) + 1)
for p in pos: out += b'%010d 00000 n \n' % p
out += b'trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n' % (len(objs) + 1, xref)
open('c6-fatura-quadros.pdf', 'wb').write(out)
print('ok', len(out), 'bytes,', len(paginas), 'paginas')
