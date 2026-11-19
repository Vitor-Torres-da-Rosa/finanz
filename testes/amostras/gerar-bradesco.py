LINHAS = [('30/09/2026', 'TRANSF SALDO C/SAL P/CC', 'REM: FULANO DE TAL O E A', '3003708', '935,37', '', '935,37'), ('30/09/2026', 'PIX ENVIADO', 'DES: FULANO DE TAL 30/09', '1045451', '', '935,37', '0,00'), ('15/10/2026', 'TRANSF SALDO C/SAL P/CC', 'REM: FULANO DE TAL O E A', '1503708', '1.124,96', '', '1.124,96'), ('15/10/2026', 'PIX ENVIADO', 'DES: FULANO DE TAL 15/10', '1125528', '', '1.124,96', '0,00'), ('30/10/2026', 'TRANSF SALDO C/SAL P/CC', 'REM: FULANO DE TAL O E A', '3003708', '1.798,05', '', '1.798,05'), ('30/10/2026', 'PIX ENVIADO', 'DES: CICLANO DA SILVA 30/10', '1346530', '', '30,00', '1.768,05'), ('30/10/2026', 'PIX ENVIADO', 'DES: FULANO DE TAL 30/10', '1626157', '', '1.768,05', '0,00'), ('13/11/2026', 'TRANSF SALDO C/SAL P/CC', 'REM: FULANO DE TAL O E A', '1303708', '1.124,96', '', '1.124,96'), ('18/11/2026', 'PIX ENVIADO', 'DES: FULANO DE TAL 18/11', '1235115', '', '1.124,96', '0,00')]
# Extrato do Bradesco Celular (pedido do Vitor em 19/11/2026), copiado do
# print: colunas Credito, Debito e Saldo; o historico na linha de cima e o
# complemento (REM:/DES:) na de baixo da linha dos numeros. Gera
# bradesco-extrato.pdf e bradesco-extrato.csv (nomes trocados).
L = [
    (800, [(40, 'F2', 'Bradesco Celular')]),
    (786, [(40, 'F1', 'Data: 19/11/2026 - 08h21')]),
    (772, [(40, 'F1', 'Nome: FULANO DE TAL')]),
    (750, [(40, 'F1', 'Extrato de: Agencia: 1234 | Conta: 56789-0'), (480, 'F1', 'Folha: 1/1')]),
    (730, [(40, 'F2', 'Data'), (110, 'F2', 'Lancamento'), (250, 'F2', 'Docto.'), (330, 'F2', 'Credito (R$)'), (410, 'F2', 'Debito (R$)'), (490, 'F2', 'Saldo (R$)')]),
]
y = 708
# O Bradesco escreve a data so no primeiro lancamento de cada dia.
ultima = ''
for d, t, comp, doc, cr, db, sd in LINHAS:
    L.append((y + 6, [(110, 'F2', t)]))
    partes = [(250, 'F1', doc)] if d == ultima else [(40, 'F1', d), (250, 'F1', doc)]
    ultima = d
    if cr: partes.append((340, 'F1', cr))
    if db: partes.append((420, 'F1', db))
    partes.append((500, 'F1', sd))
    L.append((y, partes))
    L.append((y - 7, [(110, 'F1', comp)]))
    y -= 30
L.append((y, [(110, 'F2', 'Total'), (340, 'F1', '4.983,34'), (420, 'F1', '4.983,34'), (500, 'F1', '0,00')]))
paginas = [L]
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
open('bradesco-extrato.pdf', 'wb').write(out)
print('ok', len(out), 'bytes,', len(paginas), 'paginas')

csv = ['Extrato de: Agência: 1234 | Conta: 56789-0', '', 'Data;Lançamento;Dcto.;Crédito (R$);Débito (R$);Saldo (R$);']
for d, t, comp, doc, cr, db, sd in LINHAS:
    csv.append(';'.join([d, t, doc, cr, ('-' + db) if db else '', sd, '']))
csv.append('Total;;;4.983,34;-4.983,34;0,00;')
open('bradesco-extrato.csv', 'w', encoding='latin-1').write('\r\n'.join(csv) + '\r\n')
print('csv ok')
