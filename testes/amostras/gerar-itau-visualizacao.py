# Extrato do Itau no modelo "Extrato conta corrente" (site/app), copiado
# dos prints do Vitor (19/11/2026). As linhas so com data e saldo (em
# negrito) sao o saldo do dia, nao lancamento: viravam "Entrada" de
# R$ 4.000/5.000. O saldo vem sem sinal mesmo negativo. Gera
# itau-visualizacao.pdf (nome trocado).
paginas = []
paginas.append([
    (800, [(40, 'F2', 'Extrato conta corrente')]),
    (786, [(40, 'F1', 'Periodo de visualizacao: 20/10/2026 ate 19/11/2026'), (400, 'F1', 'Emitido em: 19/11/2026 08:08:17')]),
    (760, [(40, 'F2', 'Lancamentos')]),
    (744, [(40, 'F2', 'Data'), (100, 'F2', 'Lancamentos'), (250, 'F2', 'Descricao'), (420, 'F2', 'Valor (R$)'), (500, 'F2', 'Saldo (R$)')]),
    (730, [(40, 'F1', '18/11/2026'), (500, 'F2', '3.307,01')]),
    (716, [(40, 'F1', '18/11/2026'), (100, 'F1', 'PIX RECEBIDO'), (250, 'F1', 'FULANO DE TAL SOBRENOME'), (430, 'F1', '1.824,96')]),
    (704, [(250, 'F1', 'DA SILVA')]),
    (690, [(40, 'F1', '13/11/2026'), (500, 'F2', '5.131,97')]),
    (676, [(40, 'F1', '13/11/2026'), (100, 'F1', 'PIX ENVIADO'), (250, 'F1', 'DEBORA CHRISTOVAM DA'), (430, 'F1', '-390,00')]),
    (664, [(250, 'F1', 'SILVA')]),
    (650, [(40, 'F1', '11/11/2026'), (500, 'F2', '4.741,97')]),
    (636, [(40, 'F1', '11/11/2026'), (100, 'F1', 'PIX RECEBIDO'), (250, 'F1', 'FULANO DE TAL SOBRENOME'), (440, 'F1', '477,53')]),
    (624, [(250, 'F1', 'DA SILVA')]),
    (610, [(40, 'F1', '04/11/2026'), (500, 'F2', '5.219,50')]),
    (596, [(40, 'F1', '04/11/2026'), (100, 'F1', 'PAGAMENTO DE IMPOSTO'), (250, 'F1', 'IOF'), (440, 'F1', '-30,57')]),
    (582, [(40, 'F1', '03/11/2026'), (500, 'F2', '5.188,93')]),
    (568, [(40, 'F1', '03/11/2026'), (100, 'F1', 'SAIDA'), (250, 'F1', 'JUROS LIMITE DA CONTA'), (440, 'F1', '-340,13')]),
    (554, [(40, 'F1', '29/10/2026'), (500, 'F2', '4.848,80')]),
    (520, [(500, 'F1', '1/3')]),
])
paginas.append([
    (800, [(40, 'F2', 'Data'), (100, 'F2', 'Lancamentos'), (250, 'F2', 'Descricao'), (420, 'F2', 'Valor (R$)'), (500, 'F2', 'Saldo (R$)')]),
    (786, [(40, 'F1', '29/10/2026'), (100, 'F1', 'PAGAMENTO DE PIX QR'), (250, 'F1', 'POSTO DE COMBUSTIVEL'), (440, 'F1', '-43,19')]),
    (774, [(100, 'F1', 'CODE'), (250, 'F1', 'DA FIGUEIRA LTDA')]),
    (760, [(40, 'F1', '27/10/2026'), (500, 'F2', '4.805,61')]),
    (746, [(40, 'F1', '27/10/2026'), (100, 'F1', 'PIX ENVIADO'), (250, 'F1', 'FULANO DE TAL SOBRENOME'), (430, 'F1', '-163,00')]),
    (734, [(250, 'F1', 'DA SILVA')]),
    (720, [(40, 'F1', '20/10/2026'), (500, 'F2', '4.642,61')]),
    (706, [(40, 'F1', '20/10/2026'), (100, 'F1', 'PIX RECEBIDO'), (250, 'F1', 'FULANO DE TAL SOBRENOME'), (440, 'F1', '150,00')]),
    (694, [(250, 'F1', 'DA SILVA')]),
    (680, [(40, 'F1', '20/10/2026'), (100, 'F1', 'PIX RECEBIDO'), (250, 'F1', 'FULANO DE TAL SOBRENOME'), (440, 'F1', '396,48')]),
    (668, [(250, 'F1', 'DA SILVA')]),
    (654, [(40, 'F1', '19/10/2026'), (500, 'F2', '5.189,09')]),
    (620, [(40, 'F2', 'Posicao consolidada')]),
    (606, [(40, 'F1', 'saldo disponivel sem investimentos automaticos'), (480, 'F1', 'R$ -3.307,01')]),
    (592, [(40, 'F1', '(+) saldo em aplicacao automatica - aplic aut mais'), (500, 'F1', '0,00')]),
    (578, [(40, 'F1', '(=) saldo total disponivel'), (480, 'F1', 'R$ -3.307,01')]),
    (550, [(40, 'F2', 'Limites')]),
    (536, [(40, 'F1', 'Saldo'), (480, 'F1', 'R$ -3.307,01')]),
    (522, [(40, 'F1', 'Limite disponivel'), (480, 'F1', 'R$ 1.882,99')]),
    (508, [(40, 'F1', 'Limite em uso'), (480, 'F1', 'R$ 3.307,01')]),
    (494, [(40, 'F1', 'Limite total'), (480, 'F1', 'R$ 5.190,00')]),
    (460, [(500, 'F1', '2/3')]),
])
paginas.append([
    (800, [(40, 'F2', 'Informacoes adicionais do Limite da Conta')]),
    (760, [(40, 'F1', 'Consultas, informacoes e servicos transacionais, acesse itau.com.br ou ligue 4004 4828')]),
    (740, [(500, 'F1', '3/3')]),
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
open('itau-visualizacao.pdf', 'wb').write(out)
print('ok', len(out), 'bytes,', len(paginas), 'paginas')
