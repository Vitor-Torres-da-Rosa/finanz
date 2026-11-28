# Gera as planilhas trancadas com senha usadas no t208 (senha: 123456).
#   c6-extrato-senha.xlsx: cifra "padrão" do Office (AES-128 ECB, SHA-1),
#     a mesma do extrato que o C6 manda. Nomes e valores inventados.
#   c6-extrato-senha-agil.xlsx: cifra "ágil" (a do Excel de hoje).
# Precisa de: pip install msoffcrypto-tool olefile
import io, os, struct, zipfile, hashlib
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

AQUI = os.path.dirname(os.path.abspath(__file__))
SENHA = '123456'
LINHAS = [
    ['Extrato da sua conta'],
    ['Período: 01/11/2026 a 28/11/2026'],
    [],
    ['Data Lançamento', 'Data Contábil', 'Título', 'Descrição', 'Entrada(R$)', 'Saída(R$)', 'Saldo do Dia(R$)'],
    ['03/11/2026', '03/11/2026', 'Pix recebido', 'Cliente Exemplo', 500.0, 0, 1500.0],
    ['05/11/2026', '05/11/2026', 'Pix enviado', 'Mercado Exemplo', 0, 120.5, 1379.5],
    ['10/11/2026', '10/11/2026', 'Pagamento de boleto', 'Energia Exemplo', 0, 89.9, 1289.6],
    ['21/11/2026', '21/11/2026', 'Pix recebido', 'Fulano De Tal', 250.0, 0, 1539.6],
]

def coluna(i):
    return chr(ord('A') + i)

def xlsx(compactar=True):
    textos, idx = [], {}
    def s(t):
        if t not in idx: idx[t] = len(textos); textos.append(t)
        return idx[t]
    linhas_xml = []
    for r, linha in enumerate(LINHAS, 1):
        cel = []
        for c, v in enumerate(linha):
            ref = coluna(c) + str(r)
            if isinstance(v, (int, float)):
                cel.append('<c r="%s"><v>%s</v></c>' % (ref, v))
            else:
                cel.append('<c r="%s" t="s"><v>%d</v></c>' % (ref, s(v)))
        linhas_xml.append('<row r="%d">%s</row>' % (r, ''.join(cel)))
    folha = ('<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
             '<sheetData>%s</sheetData></worksheet>' % ''.join(linhas_xml))
    ss = ('<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="%d" uniqueCount="%d">%s</sst>'
          % (len(textos), len(textos), ''.join('<si><t>%s</t></si>' % t for t in textos)))
    b = io.BytesIO()
    with zipfile.ZipFile(b, 'w', zipfile.ZIP_DEFLATED if compactar else zipfile.ZIP_STORED) as z:
        z.writestr('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>')
        z.writestr('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
        z.writestr('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Extrato" sheetId="1" r:id="rId1"/></sheets></workbook>')
        z.writestr('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>')
        z.writestr('xl/worksheets/sheet1.xml', folha)
        z.writestr('xl/sharedStrings.xml', ss)
    return b.getvalue()

def ecb(chave, dados):
    e = Cipher(algorithms.AES(chave), modes.ECB()).encryptor()
    return e.update(dados) + e.finalize()

def padrao(pacote):
    sal = os.urandom(16)
    h = hashlib.sha1(sal + SENHA.encode('utf-16-le')).digest()
    for i in range(50000):
        h = hashlib.sha1(struct.pack('<I', i) + h).digest()
    hf = hashlib.sha1(h + struct.pack('<I', 0)).digest()
    b1 = bytes((0x36 ^ hf[i]) if i < 20 else 0x36 for i in range(64))
    b2 = bytes((0x5C ^ hf[i]) if i < 20 else 0x5C for i in range(64))
    chave = (hashlib.sha1(b1).digest() + hashlib.sha1(b2).digest())[:16]
    verif = os.urandom(16)
    hv = hashlib.sha1(verif).digest() + b'\0' * 12
    csp = 'Microsoft Enhanced RSA and AES Cryptographic Provider'.encode('utf-16-le') + b'\0\0'
    cab = struct.pack('<IIIIIIII', 0x24, 0, 0x660E, 0x8004, 128, 0x18, 0, 0) + csp
    info = struct.pack('<HHI', 4, 2, 0x24) + struct.pack('<I', len(cab)) + cab
    info += struct.pack('<I', 16) + sal + ecb(chave, verif) + struct.pack('<I', 20) + ecb(chave, hv)
    corpo = pacote + b'\0' * ((16 - len(pacote) % 16) % 16)
    enc = struct.pack('<Q', len(pacote)) + ecb(chave, corpo)
    return info, enc

def cfb(fluxos):
    # Arquivo composto mínimo: setores de 512, mini setores de 64.
    S = 512
    setores, fat = [], []
    def por(dados):
        inicio = len(setores)
        n = max(1, (len(dados) + S - 1) // S)
        for i in range(n):
            setores.append(dados[i * S:(i + 1) * S].ljust(S, b'\0'))
            fat.append(inicio + i + 1 if i < n - 1 else 0xFFFFFFFE)
        return inicio
    mini, minifat, entradas = b'', [], []
    for nome, dados in fluxos:
        if len(dados) < 4096:
            ini = len(mini) // 64
            n = max(1, (len(dados) + 63) // 64)
            for i in range(n):
                minifat.append(ini + i + 1 if i < n - 1 else 0xFFFFFFFE)
            mini += dados.ljust(n * 64, b'\0')
            entradas.append((nome, ini, len(dados)))
        else:
            entradas.append((nome, por(dados), len(dados)))
    raiz = por(mini) if mini else 0xFFFFFFFE
    mf = por(b''.join(struct.pack('<I', x) for x in minifat)) if minifat else 0xFFFFFFFE
    def ent(nome, tipo, ini, tam, esq=0xFFFFFFFF, dir_=0xFFFFFFFF, filho=0xFFFFFFFF):
        n = nome.encode('utf-16-le') + b'\0\0'
        e = n.ljust(64, b'\0') + struct.pack('<HBB', len(n), tipo, 1) + struct.pack('<III', esq, dir_, filho)
        e += b'\0' * 16 + b'\0' * 4 + b'\0' * 16 + struct.pack('<IIi', ini, tam, 0)
        return e.ljust(128, b'\0')
    dirs = ent('Root Entry', 5, raiz, len(mini), filho=1)
    for i, (nome, ini, tam) in enumerate(entradas):
        dirs += ent(nome, 2, ini, tam, dir_=(i + 2) if i + 1 < len(entradas) else 0xFFFFFFFF)
    d0 = por(dirs)
    nfat = 1
    while (len(setores) + nfat) * 4 > nfat * S: nfat += 1
    fat_ini = len(setores)
    for i in range(nfat):
        setores.append(b''); fat.append(0xFFFFFFFD)
    tab = b''.join(struct.pack('<I', x) for x in fat).ljust(nfat * S, b'\xff')
    for i in range(nfat):
        setores[fat_ini + i] = tab[i * S:(i + 1) * S]
    difat = [fat_ini + i for i in range(nfat)] + [0xFFFFFFFF] * (109 - nfat)
    cab = (b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1' + b'\0' * 16 + struct.pack('<HHHHH', 0x3E, 3, 0xFFFE, 9, 6) + b'\0' * 6
           + struct.pack('<IIIIIIIII', 0, nfat, d0, 0, 4096, mf, 1 if minifat else 0, 0xFFFFFFFE, 0)
           + b''.join(struct.pack('<I', x) for x in difat))
    return cab.ljust(S, b'\0') + b''.join(setores)

plano = xlsx()
info, enc = padrao(plano)
with open(os.path.join(AQUI, 'c6-extrato-senha.xlsx'), 'wb') as f:
    f.write(cfb([('EncryptionInfo', info), ('EncryptedPackage', enc)]))

import msoffcrypto
# Confere com uma biblioteca de fora que a cifra padrão abre com a senha.
with open(os.path.join(AQUI, 'c6-extrato-senha.xlsx'), 'rb') as f:
    o = msoffcrypto.OfficeFile(f); o.load_key(password=SENHA)
    saida = io.BytesIO(); o.decrypt(saida)
    assert saida.getvalue()[:len(plano)] == plano, 'a cifra padrão não bateu'
# A ágil, pela própria biblioteca. Com o .xlsx sem compactar (maior que
# 4096 bytes): com pacote pequeno a biblioteca grava um arquivo que nem ela
# mesma abre.
from msoffcrypto.format.ooxml import OOXMLFile
plano2 = xlsx(False)
saida = io.BytesIO()
OOXMLFile(io.BytesIO(plano2)).encrypt(SENHA, saida)
with open(os.path.join(AQUI, 'c6-extrato-senha-agil.xlsx'), 'wb') as f:
    f.write(saida.getvalue())
with open(os.path.join(AQUI, 'c6-extrato-senha-agil.xlsx'), 'rb') as f:
    o = msoffcrypto.OfficeFile(f); o.load_key(password=SENHA)
    volta = io.BytesIO(); o.decrypt(volta)
    assert volta.getvalue()[:len(plano2)] == plano2, 'a cifra ágil não bateu'
print('ok')
