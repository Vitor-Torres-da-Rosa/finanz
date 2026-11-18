# Fatura do C6 no formato real: data "06 dez", parcela em negrito no meio
# da descrição, vencimento por extenso no cabeçalho e por número no Pix.
# Gera c6-fatura-parcelas.pdf (dados inventados).
#
# Versao com os quadros de informacao da fatura (pedido de 18/11/2026):
# opcoes de pagamento, tabela de encargos, totais, pagamento anterior e o
# rodape do boleto. Nada disso e compra. Gera c6-fatura-quadros.pdf.
linhas = [
    # (y, [(x, fonte, texto)])
    (800, [(40, 'F2', 'C6 BANK'), (160, 'F1', 'Vencimento: 10 de Outubro'), (330, 'F1', 'Debito automatico: Ativado')]),
    (786, [(160, 'F1', 'Valor da fatura: R$ 2.562,34'), (330, 'F1', 'Anuidade: R$0,00')]),
    (772, [(160, 'F1', 'Melhor dia de compra: 4')]),
    (740, [(40, 'F2', 'Transacoes do cartao principal')]),
    (726, [(40, 'F1', 'Lembrando: nesta fatura serao lancadas apenas transacoes feitas ate 02/10/26.')]),
    (700, [(40, 'F2', 'C6 Carbon Virtual Final 6674 - FULANO DE TAL'), (380, 'F1', 'Subtotal deste cartao R$ 381,79')]),
    (686, [(480, 'F1', 'Valores em reais')]),
    (670, [(50, 'F1', '06 dez'), (100, 'F1', 'MERCADOLIVRE*MERCADOL - '), (225, 'F2', 'Parcela 10/12'), (520, 'F1', '141,58')]),
    (656, [(50, 'F1', '06 dez'), (100, 'F1', 'HAVAN VIAMAO - '), (180, 'F2', 'Parcela 10/10'), (527, 'F1', '99,99')]),
    (642, [(50, 'F1', '04 jan'), (100, 'F1', 'HAVAN VIAMAO - '), (180, 'F2', 'Parcela 9/10'), (527, 'F1', '59,99')]),
    (628, [(50, 'F1', '04 abr'), (100, 'F1', 'ZP *WEBER MOTO PECAS L - '), (230, 'F2', 'Parcela 6/12'), (527, 'F1', '28,62')]),
    (614, [(50, 'F1', '21 abr'), (100, 'F1', 'SHOPEE *CESARIPNEUSF - '), (215, 'F2', 'Parcela 6/9'), (527, 'F1', '51,61')]),
    (590, [(40, 'F2', 'C6 Platinum Final 9534 - FULANO DE TAL'), (380, 'F1', 'Subtotal deste cartao R$ 2.180,55')]),
    (574, [(50, 'F1', '16 jul'), (100, 'F1', 'JIM.COM* FULANO DE TAL - '), (225, 'F2', 'Parcela 3/6'), (510, 'F1', '2.180,55')]),
    (560, [(50, 'F1', '08 set'), (100, 'F1', 'Inclusao de Pagamento'), (510, 'F1', '2.924,84')]),
    (548, [(50, 'F1', '13 out'), (100, 'F1', 'Pag Fatura Boleto'), (510, 'F1', '2.562,34')]),
    (520, [(40, 'F2', 'Total a pagar'), (480, 'F2', 'R$ 2.562,34')]),
    (510, [(40, 'F1', '10/11/2026')]),
    (500, [(40, 'F1', 'Gastos desta fatura'), (480, 'F1', 'R$ 369,35')]),
    (488, [(40, 'F1', 'Compras nacionais'), (480, 'F1', 'R$ 2.462,35')]),
    (470, [(40, 'F2', 'Opcoes de pagamento')]),
    (456, [(40, 'F1', '1. Pagamento total Recomendado'), (480, 'F1', 'R$ 2.462,35')]),
    (442, [(40, 'F1', '2. Parcelamento de fatura Em ate 33x de'), (480, 'F1', 'R$ 140,59')]),
    (428, [(40, 'F1', 'Juros do parcelamento em 33x 4,49% a.m.'), (480, 'F1', 'R$ 70,64')]),
    (414, [(40, 'F1', 'CET do financiamento 5,16% a.m.'), (480, 'F1', 'R$ 84,42')]),
    (400, [(40, 'F1', 'Entrada + 2x de R$ 861,34R$ 2.584,02'), (480, 'F1', 'R$ 81,59')]),
    (386, [(40, 'F1', 'IOF do parcelamento'), (480, 'F1', 'R$ 0,38')]),
    (372, [(40, 'F1', 'Juros Rotativo 19,00% a.m.'), (480, 'F1', 'R$ 730,15')]),
    (358, [(40, 'F1', 'IOF do rotativo'), (480, 'F1', 'R$ 0,38')]),
    (344, [(40, 'F1', 'Juros de mora por atraso - % a.m.'), (480, 'F1', 'R$ 1,00')]),
    (330, [(40, 'F1', 'Multa por atraso'), (480, 'F1', 'R$ 2,00')]),
    (316, [(40, 'F1', 'Juros do financiamento pos-rotativo5,99% a.m.'), (480, 'F1', 'R$ 102,95')]),
    (302, [(40, 'F1', 'IOF de financiamento - % a.m.'), (480, 'F1', 'R$ 0,38')]),
    (288, [(40, 'F1', 'IOF do atraso'), (480, 'F1', 'R$ 0,38')]),
    (270, [(40, 'F1', 'E so escanear o QR Code usando o app de qualquer banco para pagar'), (480, 'F1', 'R$ 2.462,35')]),
    (256, [(40, 'F1', '29'), (60, 'F1', 'R$ 2.462,35')]),
    (240, [(40, 'F1', 'Pague com Pix e libere seu limite em minutos'), (400, 'F1', 'Valor da fatura: R$ 2.562,34')]),
    (226, [(400, 'F1', 'Vencimento: 10/10/2026')]),
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
open('c6-fatura-quadros.pdf', 'wb').write(out)
print('ok', len(out), 'bytes')
