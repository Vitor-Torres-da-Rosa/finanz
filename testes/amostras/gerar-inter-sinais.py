# Extrato do Inter com sinais (pedido de 17/11/2026): o que entra vem
# sem sinal e o que sai vem com menos. Boleto recebido, ressarcimento e
# Pix devolvido sao entradas. A tarifa veio sem o menos de proposito: o
# saldo da linha prova que saiu. Gera inter-sinais.pdf.
# Mesmo molde do gerar-inter-saldo.py.
L = []
y = 800
def lin(*partes):
    global y
    L.append((y, list(partes)))
    y -= 16
lin((40, 'F2', 'Extrato'), (330, 'F1', 'Instituicao: Banco Inter, Agencia: 0001-9'))
lin((40, 'F1', 'Periodo: 01/11/2026 a 30/11/2026'))
lin((40, 'F1', 'Saldo disponivel:'), (200, 'F1', 'Saldo bloqueado:'))
lin((40, 'F1', 'R$ 85,84'), (200, 'F1', 'R$ 0,00'))
dias = [
  ('3 de Novembro de 2026', 'R$ 1.000,00', [
    ('Boleto recebido: "Boleto recebido 24 horas - Cliente Ana"', 'R$ 500,00', 'R$ 1.000,00')]),
  ('4 de Novembro de 2026', 'R$ 1.000,00', [
    ('Pagamento efetuado: "Pagamento fatura cartao Inter"', '-R$ 472,50', 'R$ 527,50'),
    ('Ressarcimento: "Ressarcimento - pagamento cartao"', 'R$ 472,50', 'R$ 1.000,00')]),
  ('5 de Novembro de 2026', 'R$ 1.000,00', [
    ('Pix enviado: "Joao Silva"', '-R$ 166,38', 'R$ 833,62'),
    ('Pix enviado devolvido: "Joao Silva"', 'R$ 166,38', 'R$ 1.000,00')]),
  ('6 de Novembro de 2026', 'R$ 970,00', [
    ('Tarifa: "Tarifa pacote de servicos"', 'R$ 30,00', 'R$ 970,00')]),
  ('7 de Novembro de 2026', 'R$ 1.220,00', [
    ('Pix recebido: "Maria Souza"', 'R$ 250,00', 'R$ 1.220,00')]),
]
lin((40, 'F1', ''))
for dia, saldo, its in dias:
    lin((40, 'F2', dia + ' Saldo do dia: ' + saldo), (390, 'F1', 'Valor'), (470, 'F1', 'Saldo por transacao'))
    for d, v, s in its:
        lin((40, 'F1', d), (390, 'F1', v), (480, 'F1', s))
linhas = [l for l in L if l[1][0][2] != '']
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
open('inter-sinais.pdf', 'wb').write(out)
print('ok', len(out), 'bytes')
