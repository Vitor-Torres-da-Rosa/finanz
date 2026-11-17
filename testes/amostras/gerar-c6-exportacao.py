# Extrato do C6 exportado pelo app do banco: no topo, a caixa com o
# "Periodo da Exportacao" e o "Saldo no dia da exportacao". Ela nao e
# lancamento (pedido de 17/11/2026). Gera c6-exportacao.pdf (dados inventados).
linhas = [
    (800, [(40, 'F2', 'C6 BANK'), (380, 'F1', 'FULANO DE TAL')]),
    (780, [(40, 'F1', 'Periodo da Exportacao'), (300, 'F1', 'Saldo no dia da exportacao')]),
    (766, [(40, 'F1', '30/01/2019 a 10/11/2020'), (300, 'F1', 'R$ 200,00')]),
    (740, [(40, 'F2', 'Novembro 2020 ( 01/11/2020 - 10/11/2020 )'), (350, 'F1', 'Entradas: R$ 100,00'), (470, 'F1', 'Saidas: R$ 0,00')]),
    (720, [(40, 'F1', '05/11/2020'), (110, 'F1', 'Pix recebido de FULANO'), (470, 'F1', 'R$ 100,00')]),
    (690, [(40, 'F1', 'Informacoes sujeitas a alteracao ate o final do dia')]),
]
def esc(t): return t.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')
corpo = []
for y, partes in linhas:
    for x, f, t in partes:
        corpo.append('BT /%s 9 Tf %d %d Td (%s) Tj ET' % (f, x, y, esc(t)))
stream = '\n'.join(corpo).encode('latin-1')
objs = [
    b'<< /Type /Catalog /Pages 2 0 R >>',
    b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    b'<< /Length %d >>\nstream\n' % len(stream) + stream + b'\nendstream',
]
out = bytearray(b'%PDF-1.4\n')
pos = []
for i, o in enumerate(objs, 1):
    pos.append(len(out))
    out += b'%d 0 obj\n' % i + o + b'\nendobj\n'
xref = len(out)
out += b'xref\n0 %d\n0000000000 65535 f \n' % (len(objs) + 1)
for p in pos: out += b'%010d 00000 n \n' % p
out += b'trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n' % (len(objs) + 1, xref)
open('c6-exportacao.pdf', 'wb').write(out)
print('ok', len(out), 'bytes')
