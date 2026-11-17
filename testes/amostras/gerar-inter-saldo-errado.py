# Igual ao gerar-inter-saldo.py, com um valor lido errado de proposito. Extrato do Banco Inter com as colunas "Valor" e "Saldo por transacao"
# (pedido de 17/11/2026). A soma usa so a coluna Valor; o saldo de cada
# linha serve de conferencia. Gera inter-saldo-errado.pdf (dados do
# print do Vitor, descricoes resumidas).
L = []
y = 800
def lin(*partes):
    global y
    L.append((y, list(partes)))
    y -= 16
lin((40, 'F2', 'Extrato'), (330, 'F1', 'Instituicao: Banco Inter, Agencia: 0001-9'))
lin((40, 'F1', 'Periodo: 01/11/2020 a 30/11/2020'))
lin((40, 'F1', 'Saldo disponivel:'), (200, 'F1', 'Saldo bloqueado:'))
lin((40, 'F1', 'R$ 85,84'), (200, 'F1', 'R$ 0,00'))
dias = [
  ('2 de Novembro de 2020', 'R$ 80,40', [
    ('Pix recebido: "Cashback - Free Fire"', 'R$ 0,40', 'R$ 0,40'),
    ('Pix enviado: "Compra de Giftcard - Free Fire"', '-R$ 20,00', '-R$ 19,60'),
    ('Pix recebido: "Recebido - 112/00336022126"', 'R$ 10,00', 'R$ 80,40')]),
  ('3 de Novembro de 2020', 'R$ 51,00', [
    ('Pix recebido: "Cashback - Google Play"', 'R$ 0,60', 'R$ 81,00'),
    ('Pix enviado: "Compra de Giftcard - Google Play"', '-R$ 30,00', 'R$ 51,00')]),
  ('5 de Novembro de 2020', 'R$ 51,27', [
    ('TED: "Transferencia recebida - Paypal Do Brasil"', 'R$ 0,16', 'R$ 51,16'),
    ('TED: "Transferencia recebida - Paypal Do Brasil"', 'R$ 0,11', 'R$ 51,27')]),
  ('9 de Novembro de 2020', 'R$ 2,27', [
    ('Pix enviado: "Compra de Giftcard - Google Play"', '-R$ 50,00', 'R$ 1,27'),
    ('Pix recebido: "Cashback - Google Play"', 'R$ 1,00', 'R$ 2,27')]),
  ('10 de Novembro de 2020', 'R$ 0,00', [
    ('Aplicacao: "Aplicacao poupanca - Renda fixa"', '-R$ 2,27', '-R$ 0,00')]),
  ('12 de Novembro de 2020', 'R$ 47,00', [
    ('TED: "Transferencia recebida - Paypal Do Brasil"', 'R$ 47,00', 'R$ 47,00')]),
  ('13 de Novembro de 2020', 'R$ 0,00', [
    ('TED: "Transferencia enviada - 102 0003 0000002227040 Vitor"', '-R$ 47,00', '-R$ 0,00')]),
  ('16 de Novembro de 2020', 'R$ 5,00', [
    ('TED: "Transferencia recebida - Picpay Servicos S.a"', 'R$ 5,00', 'R$ 5,00')]),
  ('20 de Novembro de 2020', 'R$ 7,27', [
    ('Resgate: "Resgate poupanca - Renda fixa"', 'R$ 2,27', 'R$ 7,27')]),
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
open('inter-saldo-errado.pdf', 'wb').write(out)
print('ok', len(out), 'bytes')
