  // =========================================================================
  // Leitor de extrato e de fatura. Abre PDF (inclusive com senha), planilha
  // xlsx, OFX e CSV, sem depender de nenhuma biblioteca de fora. Só lê.
  // =========================================================================
  var Extrato = (function () {
  // ---------------------------------------------------------------------------
  // Leitor de PDF em JavaScript puro. Serve para tirar o texto de um extrato
  // bancário, inclusive quando o arquivo tem senha. Não desenha nada: só lê.
  // ---------------------------------------------------------------------------

    var subtle = (typeof crypto !== 'undefined' && crypto.subtle) || null;

    // ---------- utilidades de bytes ----------

    function bytesDeTexto(t) {
      var b = new Uint8Array(t.length);
      for (var i = 0; i < t.length; i++) b[i] = t.charCodeAt(i) & 255;
      return b;
    }

    function textoDeBytes(b) {
      var partes = [];
      for (var i = 0; i < b.length; i += 8192) {
        partes.push(String.fromCharCode.apply(null, b.subarray(i, i + 8192)));
      }
      return partes.join('');
    }

    function juntar(lista) {
      var n = 0, i;
      for (i = 0; i < lista.length; i++) n += lista[i].length;
      var fora = new Uint8Array(n), p = 0;
      for (i = 0; i < lista.length; i++) { fora.set(lista[i], p); p += lista[i].length; }
      return fora;
    }

    function ouExclusivo(a, b) {
      var fora = new Uint8Array(a.length);
      for (var i = 0; i < a.length; i++) fora[i] = a[i] ^ b[i];
      return fora;
    }

    // ---------- MD5 (preciso dele para as senhas antigas do PDF) ----------

    function md5(entrada) {
      function girar(x, c) { return (x << c) | (x >>> (32 - c)); }
      function somar(a, b) { return (a + b) | 0; }

      var S = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,
               5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,
               4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,
               6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
      var K = [];
      for (var i = 0; i < 64; i++) K[i] = (Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296)) | 0;

      var n = entrada.length;
      var comFim = new Uint8Array((((n + 8) >> 6) + 1) << 6);
      comFim.set(entrada);
      comFim[n] = 0x80;
      var bits = n * 8;
      for (var j = 0; j < 4; j++) comFim[comFim.length - 8 + j] = (bits >>> (8 * j)) & 255;

      var a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
      var M = new Int32Array(16);

      for (var bloco = 0; bloco < comFim.length; bloco += 64) {
        for (var k = 0; k < 16; k++) {
          M[k] = comFim[bloco + k * 4] | (comFim[bloco + k * 4 + 1] << 8) |
                 (comFim[bloco + k * 4 + 2] << 16) | (comFim[bloco + k * 4 + 3] << 24);
        }
        var A = a0, B = b0, C = c0, D = d0;
        for (var t = 0; t < 64; t++) {
          var F, g;
          if (t < 16) { F = (B & C) | (~B & D); g = t; }
          else if (t < 32) { F = (D & B) | (~D & C); g = (5 * t + 1) % 16; }
          else if (t < 48) { F = B ^ C ^ D; g = (3 * t + 5) % 16; }
          else { F = C ^ (B | ~D); g = (7 * t) % 16; }
          F = somar(somar(somar(F, A), K[t]), M[g]);
          A = D; D = C; C = B;
          B = somar(B, girar(F, S[t]));
        }
        a0 = somar(a0, A); b0 = somar(b0, B); c0 = somar(c0, C); d0 = somar(d0, D);
      }

      var fora = new Uint8Array(16);
      [a0, b0, c0, d0].forEach(function (v, idx) {
        for (var q = 0; q < 4; q++) fora[idx * 4 + q] = (v >>> (8 * q)) & 255;
      });
      return fora;
    }

    // ---------- RC4 ----------

    function rc4(chave, dados) {
      var s = new Uint8Array(256), i, j = 0, tmp;
      for (i = 0; i < 256; i++) s[i] = i;
      for (i = 0; i < 256; i++) {
        j = (j + s[i] + chave[i % chave.length]) & 255;
        tmp = s[i]; s[i] = s[j]; s[j] = tmp;
      }
      var fora = new Uint8Array(dados.length);
      i = 0; j = 0;
      for (var k = 0; k < dados.length; k++) {
        i = (i + 1) & 255;
        j = (j + s[i]) & 255;
        tmp = s[i]; s[i] = s[j]; s[j] = tmp;
        fora[k] = dados[k] ^ s[(s[i] + s[j]) & 255];
      }
      return fora;
    }

    // ---------- AES pelo WebCrypto ----------

    function importarAes(chave, uso) {
      return subtle.importKey('raw', chave, { name: 'AES-CBC' }, false, uso);
    }

    var ZERO16 = new Uint8Array(16);

    // O WebCrypto sempre cuida do enchimento. Para cifrar um bloco cru eu cifro
    // e jogo fora o bloco de enchimento que ele acrescenta no fim.
    function cifrarSemEnchimento(chave, iv, dados) {
      return importarAes(chave, ['encrypt']).then(function (k) {
        return subtle.encrypt({ name: 'AES-CBC', iv: iv }, k, dados);
      }).then(function (b) {
        return new Uint8Array(b).subarray(0, dados.length);
      });
    }

    // Para decifrar sem enchimento eu acrescento um bloco que decifra num
    // enchimento válido, e aí o WebCrypto aceita e devolve só o que interessa.
    function decifrarSemEnchimento(chave, iv, dados) {
      if (!dados.length) return Promise.resolve(new Uint8Array(0));
      var ultimo = dados.subarray(dados.length - 16);
      var enchimento = new Uint8Array(16);
      for (var i = 0; i < 16; i++) enchimento[i] = 16;
      var alvo = ouExclusivo(enchimento, ultimo);
      return cifrarSemEnchimento(chave, ZERO16, alvo).then(function (extra) {
        var completo = juntar([dados, extra]);
        return importarAes(chave, ['decrypt']).then(function (k) {
          return subtle.decrypt({ name: 'AES-CBC', iv: iv }, k, completo);
        });
      }).then(function (b) { return new Uint8Array(b); });
    }

    // Nos fluxos do PDF os 16 primeiros bytes são o vetor inicial.
    function decifrarAes(chave, dados) {
      if (dados.length <= 16) return Promise.resolve(new Uint8Array(0));
      var iv = dados.subarray(0, 16);
      var corpo = dados.subarray(16);
      var sobra = corpo.length % 16;
      if (sobra) corpo = corpo.subarray(0, corpo.length - sobra);
      return importarAes(chave, ['decrypt']).then(function (k) {
        return subtle.decrypt({ name: 'AES-CBC', iv: iv }, k, corpo);
      }).then(function (b) { return new Uint8Array(b); })
        .catch(function () { return decifrarSemEnchimento(chave, iv, corpo); });
    }

    function digerir(nome, dados) {
      return subtle.digest(nome, dados).then(function (b) { return new Uint8Array(b); });
    }


    // ---------- leitor de objetos (sintaxe do PDF) ----------

    function Lex(txt, pos) { this.t = txt; this.i = pos || 0; }

    Lex.prototype.pularBrancos = function () {
      for (;;) {
        var c = this.t.charCodeAt(this.i);
        if (c === 32 || c === 10 || c === 13 || c === 9 || c === 0 || c === 12) { this.i++; continue; }
        if (this.t[this.i] === '%') { while (this.i < this.t.length && this.t.charCodeAt(this.i) !== 10 && this.t.charCodeAt(this.i) !== 13) this.i++; continue; }
        return;
      }
    };

    function delimitador(c) { return '()<>[]{}/%'.indexOf(c) >= 0; }
    function branco(c) { var k = c.charCodeAt(0); return k === 32 || k === 10 || k === 13 || k === 9 || k === 0 || k === 12; }

    Lex.prototype.nome = function () {
      this.i++; // a barra
      var fora = '';
      while (this.i < this.t.length) {
        var c = this.t[this.i];
        if (branco(c) || delimitador(c)) break;
        if (c === '#') {
          fora += String.fromCharCode(parseInt(this.t.substr(this.i + 1, 2), 16) || 0);
          this.i += 3;
          continue;
        }
        fora += c; this.i++;
      }
      return { nome: fora };
    };

    Lex.prototype.textoLiteral = function () {
      this.i++; // o (
      var fora = [], nivel = 1;
      while (this.i < this.t.length) {
        var c = this.t[this.i];
        if (c === '\\') {
          var d = this.t[this.i + 1];
          this.i += 2;
          if (d === 'n') fora.push(10);
          else if (d === 'r') fora.push(13);
          else if (d === 't') fora.push(9);
          else if (d === 'b') fora.push(8);
          else if (d === 'f') fora.push(12);
          else if (d === '\n') { /* quebra escapada: nada */ }
          else if (d === '\r') { if (this.t[this.i] === '\n') this.i++; }
          else if (d >= '0' && d <= '7') {
            var oct = d;
            while (oct.length < 3 && this.t[this.i] >= '0' && this.t[this.i] <= '7') { oct += this.t[this.i]; this.i++; }
            fora.push(parseInt(oct, 8) & 255);
          } else fora.push(d.charCodeAt(0) & 255);
          continue;
        }
        if (c === '(') nivel++;
        if (c === ')') { nivel--; if (!nivel) { this.i++; break; } }
        fora.push(c.charCodeAt(0) & 255);
        this.i++;
      }
      return { bytes: new Uint8Array(fora) };
    };

    Lex.prototype.textoHex = function () {
      this.i++; // o <
      var digitos = '';
      while (this.i < this.t.length && this.t[this.i] !== '>') {
        var c = this.t[this.i];
        if (/[0-9a-fA-F]/.test(c)) digitos += c;
        this.i++;
      }
      this.i++;
      if (digitos.length % 2) digitos += '0';
      var b = new Uint8Array(digitos.length / 2);
      for (var k = 0; k < b.length; k++) b[k] = parseInt(digitos.substr(k * 2, 2), 16);
      return { bytes: b };
    };

    Lex.prototype.valor = function () {
      this.pularBrancos();
      if (this.i >= this.t.length) return null;
      var c = this.t[this.i];

      if (c === '/') return this.nome();
      if (c === '(') return this.textoLiteral();
      if (c === '[') {
        this.i++;
        var lista = [];
        for (;;) {
          this.pularBrancos();
          if (this.t[this.i] === ']') { this.i++; break; }
          if (this.i >= this.t.length) break;
          var v = this.valor();
          if (v === undefined) break;
          lista.push(v);
        }
        return lista;
      }
      if (c === '<') {
        if (this.t[this.i + 1] === '<') {
          this.i += 2;
          var d = {};
          for (;;) {
            this.pularBrancos();
            if (this.t[this.i] === '>' && this.t[this.i + 1] === '>') { this.i += 2; break; }
            if (this.i >= this.t.length) break;
            if (this.t[this.i] !== '/') { this.i++; continue; }
            var ch = this.nome().nome;
            var vv = this.valor();
            d[ch] = vv;
          }
          return { dic: d };
        }
        return this.textoHex();
      }
      if (c === ']' || c === '>' || c === '}' || c === ')') { this.i++; return undefined; }
      if (c === '{') { this.i++; return undefined; }

      // palavra ou número
      var ini = this.i;
      while (this.i < this.t.length && !branco(this.t[this.i]) && !delimitador(this.t[this.i])) this.i++;
      var bruto = this.t.slice(ini, this.i);
      if (!bruto) { this.i++; return undefined; }

      if (/^[+-]?[\d.]+$/.test(bruto)) {
        // referência? "12 0 R"
        var guarda = this.i;
        var m = /^\s*(\d+)\s+R\b/.exec(this.t.slice(this.i, this.i + 24));
        if (m && /^\d+$/.test(bruto)) {
          this.i += m[0].length;
          return { ref: parseInt(bruto, 10), ger: parseInt(m[1], 10) };
        }
        this.i = guarda;
        var n = parseFloat(bruto);
        return isFinite(n) ? n : 0;
      }
      if (bruto === 'true') return true;
      if (bruto === 'false') return false;
      if (bruto === 'null') return null;
      return { palavra: bruto };
    };

    // ---------- filtros ----------

    function desinflar(dados, formato) {
      return new Promise(function (ok, erro) {
        var ds;
        try { ds = new DecompressionStream(formato); } catch (e) { erro(e); return; }
        // O erro pode vir pelo escritor ou pela leitura; os dois precisam de
        // tratamento, senão ele escapa e derruba a página.
        var escritor = ds.writable.getWriter();
        escritor.write(dados).catch(function () {});
        escritor.close().catch(function () {});
        new Response(ds.readable).arrayBuffer().then(function (b) {
          ok(new Uint8Array(b));
        }, erro);
      });
    }

    function inflar(dados, cru) {
      var primeiro = cru ? 'deflate-raw' : 'deflate';
      var segundo = cru ? 'deflate' : 'deflate-raw';
      return desinflar(dados, primeiro)
        .catch(function () { return desinflar(dados, segundo); })
        .catch(function () { return new Uint8Array(0); });
    }

    function asciiHex(dados) {
      var t = textoDeBytes(dados), d = '';
      for (var i = 0; i < t.length; i++) {
        if (t[i] === '>') break;
        if (/[0-9a-fA-F]/.test(t[i])) d += t[i];
      }
      if (d.length % 2) d += '0';
      var b = new Uint8Array(d.length / 2);
      for (var k = 0; k < b.length; k++) b[k] = parseInt(d.substr(k * 2, 2), 16);
      return b;
    }

    function ascii85(dados) {
      var t = textoDeBytes(dados).replace(/\s+/g, '');
      if (t.slice(0, 2) === '<~') t = t.slice(2);
      var fim = t.indexOf('~>'); if (fim >= 0) t = t.slice(0, fim);
      var fora = [], grupo = [], i;
      for (i = 0; i < t.length; i++) {
        var c = t[i];
        if (c === 'z' && !grupo.length) { fora.push(0, 0, 0, 0); continue; }
        grupo.push(c.charCodeAt(0) - 33);
        if (grupo.length === 5) {
          var v = 0;
          for (var j = 0; j < 5; j++) v = v * 85 + grupo[j];
          fora.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
          grupo = [];
        }
      }
      if (grupo.length) {
        var falta = 5 - grupo.length;
        for (var q = 0; q < falta; q++) grupo.push(84);
        var w = 0;
        for (var z = 0; z < 5; z++) w = w * 85 + grupo[z];
        var quatro = [(w >>> 24) & 255, (w >>> 16) & 255, (w >>> 8) & 255, w & 255];
        for (var y = 0; y < 4 - falta; y++) fora.push(quatro[y]);
      }
      return new Uint8Array(fora);
    }

    function runLength(dados) {
      var fora = [], i = 0;
      while (i < dados.length) {
        var n = dados[i++];
        if (n === 128) break;
        if (n < 128) { for (var k = 0; k <= n; k++) fora.push(dados[i++]); }
        else { var b = dados[i++]; for (var j = 0; j < 257 - n; j++) fora.push(b); }
      }
      return new Uint8Array(fora);
    }

    function lzw(dados, primeiro) {
      var cedo = primeiro === 0 ? 0 : 1;
      var dic = [], i;
      function reiniciar() { dic = []; for (i = 0; i < 256; i++) dic[i] = [i]; dic[256] = null; dic[257] = null; }
      reiniciar();
      var largura = 9, buffer = 0, bits = 0, anterior = null, fora = [];
      for (var p = 0; p < dados.length; p++) {
        buffer = (buffer << 8) | dados[p]; bits += 8;
        while (bits >= largura) {
          var cod = (buffer >> (bits - largura)) & ((1 << largura) - 1);
          bits -= largura;
          if (cod === 256) { reiniciar(); largura = 9; anterior = null; continue; }
          if (cod === 257) { p = dados.length; break; }
          var entrada;
          if (cod < dic.length && dic[cod]) entrada = dic[cod];
          else if (anterior) entrada = anterior.concat([anterior[0]]);
          else continue;
          for (i = 0; i < entrada.length; i++) fora.push(entrada[i]);
          if (anterior) dic.push(anterior.concat([entrada[0]]));
          anterior = entrada;
          if (dic.length + cedo >= (1 << largura) && largura < 12) largura++;
        }
      }
      return new Uint8Array(fora);
    }

    // Previsor PNG/TIFF, usado principalmente nos fluxos de referência cruzada.
    function desprever(dados, parms, pegar) {
      if (!parms) return dados;
      var pre = pegar(parms.Predictor) || 1;
      if (pre <= 1) return dados;
      var cores = pegar(parms.Colors) || 1;
      var bpc = pegar(parms.BitsPerComponent) || 8;
      var colunas = pegar(parms.Columns) || 1;
      var bpp = Math.ceil(cores * bpc / 8);
      var linha = Math.ceil(cores * bpc * colunas / 8);

      if (pre === 2) {
        if (bpc !== 8) return dados;
        for (var r = 0; r + linha <= dados.length; r += linha) {
          for (var c = bpp; c < linha; c++) dados[r + c] = (dados[r + c] + dados[r + c - bpp]) & 255;
        }
        return dados;
      }

      var linhas = Math.floor(dados.length / (linha + 1));
      var fora = new Uint8Array(linhas * linha);
      var cima = new Uint8Array(linha);
      for (var y = 0; y < linhas; y++) {
        var tipo = dados[y * (linha + 1)];
        var atual = dados.subarray(y * (linha + 1) + 1, y * (linha + 1) + 1 + linha);
        var nova = new Uint8Array(linha);
        for (var x = 0; x < linha; x++) {
          var a = x >= bpp ? nova[x - bpp] : 0;
          var b = cima[x];
          var cc = x >= bpp ? cima[x - bpp] : 0;
          var v = atual[x];
          if (tipo === 0) nova[x] = v;
          else if (tipo === 1) nova[x] = (v + a) & 255;
          else if (tipo === 2) nova[x] = (v + b) & 255;
          else if (tipo === 3) nova[x] = (v + ((a + b) >> 1)) & 255;
          else {
            var pp = a + b - cc, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - cc);
            nova[x] = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : cc)) & 255;
          }
        }
        fora.set(nova, y * linha);
        cima = nova;
      }
      return fora;
    }


    var ENCHIMENTO = new Uint8Array([
      0x28,0xBF,0x4E,0x5E,0x4E,0x75,0x8A,0x41,0x64,0x00,0x4E,0x56,0xFF,0xFA,0x01,0x08,
      0x2E,0x2E,0x00,0xB6,0xD0,0x68,0x3E,0x80,0x2F,0x0C,0xA9,0xFE,0x64,0x53,0x69,0x7A]);

    function ehDic(v) { return v && typeof v === 'object' && v.dic; }
    function ehRef(v) { return v && typeof v === 'object' && typeof v.ref === 'number'; }
    function ehBytes(v) { return v && v.bytes instanceof Uint8Array; }
    function ehNome(v) { return v && typeof v.nome === 'string'; }

    function Documento(bytes) {
      this.bytes = bytes;
      this.txt = textoDeBytes(bytes);
      this.objetos = {};      // num -> { valor, fluxoIni, fluxoFim, ger }
      this.cifra = null;
      this.chave = null;
    }

    Documento.prototype.pegar = function (v) {
      var voltas = 0;
      while (ehRef(v) && voltas++ < 32) {
        var o = this.objetos[v.ref];
        v = o ? o.valor : null;
      }
      return v;
    };

    Documento.prototype.dic = function (v) {
      var d = this.pegar(v);
      return ehDic(d) ? d.dic : null;
    };

    // Varre o arquivo inteiro atrás de "N G obj". É mais teimoso do que seguir a
    // tabela de referência cruzada, que costuma vir quebrada em arquivo remendado.
    Documento.prototype.varrer = function () {
      var re = /(\d+)\s+(\d+)\s+obj\b/g, m;
      while ((m = re.exec(this.txt))) {
        var num = parseInt(m[1], 10), ger = parseInt(m[2], 10);
        var lex = new Lex(this.txt, m.index + m[0].length);
        var valor;
        try { valor = lex.valor(); } catch (e) { continue; }
        var reg = { valor: valor, ger: ger, fluxoIni: -1, fluxoFim: -1, num: num };

        lex.pularBrancos();
        if (this.txt.substr(lex.i, 6) === 'stream') {
          var p = lex.i + 6;
          if (this.txt[p] === '\r') p++;
          if (this.txt[p] === '\n') p++;
          reg.fluxoIni = p;
          var d = ehDic(valor) ? valor.dic : null;
          var comp = d ? this.pegar(d.Length) : null;
          var fim = -1;
          if (typeof comp === 'number' && comp > 0 && p + comp <= this.txt.length) {
            var apos = this.txt.substr(p + comp, 20);
            if (/^\s*endstream/.test(apos)) fim = p + comp;
          }
          if (fim < 0) {
            var e = this.txt.indexOf('endstream', p);
            fim = e < 0 ? this.txt.length : e;
            while (fim > p && (this.txt.charCodeAt(fim - 1) === 10 || this.txt.charCodeAt(fim - 1) === 13)) fim--;
          }
          reg.fluxoFim = fim;
        }
        // Um objeto remendado depois vale mais do que o original.
        this.objetos[num] = reg;
      }
    };

    Documento.prototype.acharTrailer = function () {
      var achado = { encrypt: null, id: null, raiz: null };
      var re = /trailer/g, m;
      while ((m = re.exec(this.txt))) {
        var lex = new Lex(this.txt, m.index + 7);
        var v;
        try { v = lex.valor(); } catch (e) { continue; }
        if (!ehDic(v)) continue;
        if (v.dic.Encrypt) achado.encrypt = v.dic.Encrypt;
        if (v.dic.ID) achado.id = v.dic.ID;
        if (v.dic.Root) achado.raiz = v.dic.Root;
      }
      // PDF moderno guarda isso no fluxo de referência cruzada.
      for (var num in this.objetos) {
        var d = ehDic(this.objetos[num].valor) ? this.objetos[num].valor.dic : null;
        if (!d || !ehNome(d.Type) || d.Type.nome !== 'XRef') continue;
        if (d.Encrypt && !achado.encrypt) achado.encrypt = d.Encrypt;
        if (d.ID && !achado.id) achado.id = d.ID;
        if (d.Root && !achado.raiz) achado.raiz = d.Root;
      }
      return achado;
    };

    // ---------- senha ----------

    Documento.prototype.prepararCifra = function (senha) {
      var eu = this;
      var t = this.acharTrailer();
      if (!t.encrypt) return Promise.resolve({ ok: true, precisaSenha: false });

      var enc = this.dic(t.encrypt);
      if (!enc) return Promise.resolve({ ok: true, precisaSenha: false });

      var V = this.pegar(enc.V) || 0;
      var R = this.pegar(enc.R) || 2;
      var comprimento = (this.pegar(enc.Length) || 40) / 8;
      var O = ehBytes(this.pegar(enc.O)) ? this.pegar(enc.O).bytes : new Uint8Array(32);
      var U = ehBytes(this.pegar(enc.U)) ? this.pegar(enc.U).bytes : new Uint8Array(32);
      var Perm = this.pegar(enc.P);
      if (typeof Perm !== 'number') Perm = -1;
      var metadados = this.pegar(enc.EncryptMetadata);
      var idBytes = new Uint8Array(0);
      var id = this.pegar(t.id);
      if (Array.isArray(id) && ehBytes(this.pegar(id[0]))) idBytes = this.pegar(id[0]).bytes;

      // Que algoritmo cada coisa usa
      var modo = V >= 5 ? 'aes256' : (V === 4 ? 'v4' : 'rc4');
      if (modo === 'v4') {
        var cf = this.dic(enc.CF);
        var nomeStm = ehNome(this.pegar(enc.StmF)) ? this.pegar(enc.StmF).nome : 'Identity';
        var filtro = cf ? this.dic(cf[nomeStm]) : null;
        var cfm = filtro && ehNome(this.pegar(filtro.CFM)) ? this.pegar(filtro.CFM).nome : 'V2';
        modo = cfm === 'AESV2' ? 'aes128' : (cfm === 'AESV3' ? 'aes256' : (cfm === 'None' ? 'nenhum' : 'rc4'));
        if (filtro && this.pegar(filtro.Length)) {
          var L = this.pegar(filtro.Length);
          comprimento = L > 40 ? L / 8 : L;
        }
      }
      this.cifra = { modo: modo, R: R, comprimento: comprimento };

      var senhaBytes = bytesDeTexto(String(senha == null ? '' : senha));

      if (R >= 5) {
        return this.chaveR6(senhaBytes, enc, U, O).then(function (chave) {
          if (!chave) return { ok: false, precisaSenha: true };
          eu.chave = chave;
          return { ok: true, precisaSenha: false };
        });
      }

      var chave = this.chaveAntiga(senhaBytes, O, Perm, idBytes, R, comprimento, metadados);
      this.chave = chave;
      return this.conferirAntiga(chave, U, idBytes, R).then(function (bate) {
        if (bate) return { ok: true, precisaSenha: false };
        // A senha do dono também abre: ela gera a do usuário.
        var doDono = eu.senhaDoDono(senhaBytes, O, R, comprimento);
        var chave2 = eu.chaveAntiga(doDono, O, Perm, idBytes, R, comprimento, metadados);
        eu.chave = chave2;
        return eu.conferirAntiga(chave2, U, idBytes, R).then(function (bate2) {
          if (bate2) return { ok: true, precisaSenha: false };
          eu.chave = chave;
          return { ok: false, precisaSenha: true };
        });
      });
    };

    Documento.prototype.chaveAntiga = function (senhaBytes, O, Perm, idBytes, R, comprimento, metadados) {
      var enchida = new Uint8Array(32);
      var n = Math.min(senhaBytes.length, 32);
      enchida.set(senhaBytes.subarray(0, n));
      enchida.set(ENCHIMENTO.subarray(0, 32 - n), n);

      var permBytes = new Uint8Array(4);
      for (var i = 0; i < 4; i++) permBytes[i] = (Perm >> (8 * i)) & 255;

      var pedacos = [enchida, O.subarray(0, 32), permBytes, idBytes];
      if (R >= 4 && metadados === false) pedacos.push(new Uint8Array([255, 255, 255, 255]));

      var chave = md5(juntar(pedacos));
      var tam = R === 2 ? 5 : Math.max(5, Math.min(16, comprimento));
      if (R >= 3) {
        for (var k = 0; k < 50; k++) chave = md5(chave.subarray(0, tam));
      }
      return chave.subarray(0, tam);
    };

    Documento.prototype.senhaDoDono = function (senhaBytes, O, R, comprimento) {
      var enchida = new Uint8Array(32);
      var n = Math.min(senhaBytes.length, 32);
      enchida.set(senhaBytes.subarray(0, n));
      enchida.set(ENCHIMENTO.subarray(0, 32 - n), n);
      var chave = md5(enchida);
      var tam = R === 2 ? 5 : Math.max(5, Math.min(16, comprimento));
      if (R >= 3) { for (var k = 0; k < 50; k++) chave = md5(chave); }
      chave = chave.subarray(0, tam);
      var fora = O.subarray(0, 32);
      if (R === 2) return rc4(chave, fora);
      for (var i = 19; i >= 0; i--) {
        var c = new Uint8Array(chave.length);
        for (var j = 0; j < chave.length; j++) c[j] = chave[j] ^ i;
        fora = rc4(c, fora);
      }
      return fora;
    };

    Documento.prototype.conferirAntiga = function (chave, U, idBytes, R) {
      if (R === 2) {
        var esperado = rc4(chave, ENCHIMENTO);
        return Promise.resolve(iguais(esperado, U.subarray(0, 32), 32));
      }
      var base = md5(juntar([ENCHIMENTO, idBytes]));
      var fora = rc4(chave, base);
      for (var i = 1; i <= 19; i++) {
        var c = new Uint8Array(chave.length);
        for (var j = 0; j < chave.length; j++) c[j] = chave[j] ^ i;
        fora = rc4(c, fora);
      }
      return Promise.resolve(iguais(fora, U.subarray(0, 16), 16));
    };

    function iguais(a, b, n) {
      for (var i = 0; i < n; i++) if (a[i] !== b[i]) return false;
      return true;
    }

    // Algoritmo 2.B: o embaralhamento pesado do PDF 2.0 / AES-256.
    function hash2B(senha, sal, extra, R) {
      return digerir('SHA-256', juntar([senha, sal, extra])).then(function (K) {
        if (R === 5) return K;
        var i = 0;
        function volta() {
          var uma = juntar([senha, K, extra]);
          var K1 = new Uint8Array(uma.length * 64);
          for (var r = 0; r < 64; r++) K1.set(uma, r * uma.length);
          return cifrarSemEnchimento(K.subarray(0, 16), K.subarray(16, 32), K1).then(function (E) {
            var soma = 0;
            for (var s = 0; s < 16; s++) soma += E[s];
            var qual = soma % 3;
            return digerir(qual === 0 ? 'SHA-256' : qual === 1 ? 'SHA-384' : 'SHA-512', E)
              .then(function (novo) {
                K = novo;
                i++;
                if (i >= 64 && E[E.length - 1] <= i - 32) return K.subarray(0, 32);
                if (i > 300) return K.subarray(0, 32);
                return volta();
              });
          });
        }
        return volta();
      });
    }

    Documento.prototype.chaveR6 = function (senhaBytes, enc, U, O) {
      var eu = this;
      var R = this.pegar(enc.R) || 6;
      var UE = ehBytes(this.pegar(enc.UE)) ? this.pegar(enc.UE).bytes : new Uint8Array(32);
      var OE = ehBytes(this.pegar(enc.OE)) ? this.pegar(enc.OE).bytes : new Uint8Array(32);
      var senha = senhaBytes.subarray(0, 127);

      var valU = U.subarray(32, 40), salU = U.subarray(40, 48);
      var valO = O.subarray(32, 40), salO = O.subarray(40, 48);

      return hash2B(senha, valU, new Uint8Array(0), R).then(function (h) {
        if (iguais(h, U.subarray(0, 32), 32)) {
          return hash2B(senha, salU, new Uint8Array(0), R).then(function (inter) {
            return decifrarSemEnchimento(inter, new Uint8Array(16), UE);
          });
        }
        // senha do dono
        return hash2B(senha, valO, U.subarray(0, 48), R).then(function (h2) {
          if (!iguais(h2, O.subarray(0, 32), 32)) return null;
          return hash2B(senha, salO, U.subarray(0, 48), R).then(function (inter) {
            return decifrarSemEnchimento(inter, new Uint8Array(16), OE);
          });
        });
      }).then(function (chave) {
        return chave ? chave.subarray(0, 32) : null;
      }).catch(function () { return null; });
    };

    // ---------- fluxos ----------

    Documento.prototype.decifrarDados = function (dados, num, ger) {
      if (!this.chave || !this.cifra || this.cifra.modo === 'nenhum') return Promise.resolve(dados);
      var modo = this.cifra.modo;
      if (modo === 'aes256') return decifrarAes(this.chave, dados);

      var extra = new Uint8Array([num & 255, (num >> 8) & 255, (num >> 16) & 255, ger & 255, (ger >> 8) & 255]);
      var pedacos = [this.chave, extra];
      if (modo === 'aes128') pedacos.push(new Uint8Array([0x73, 0x41, 0x6C, 0x54]));
      var chaveObj = md5(juntar(pedacos)).subarray(0, Math.min(this.chave.length + 5, 16));
      if (modo === 'aes128') return decifrarAes(chaveObj, dados);
      return Promise.resolve(rc4(chaveObj, dados));
    };

    Documento.prototype.fluxo = function (num) {
      var eu = this;
      var reg = this.objetos[num];
      if (!reg || reg.fluxoIni < 0) return Promise.resolve(new Uint8Array(0));
      if (reg.pronto) return Promise.resolve(reg.pronto);

      var cru = this.bytes.subarray(reg.fluxoIni, reg.fluxoFim);
      var d = ehDic(reg.valor) ? reg.valor.dic : {};
      var tipo = ehNome(this.pegar(d.Type)) ? this.pegar(d.Type).nome : '';

      // O fluxo de referência cruzada nunca é cifrado.
      var passo = tipo === 'XRef' ? Promise.resolve(cru) : this.decifrarDados(cru, num, reg.ger);

      return passo.then(function (dados) {
        var filtros = eu.pegar(d.Filter);
        var parms = eu.pegar(d.DecodeParms) || eu.pegar(d.DP);
        if (!filtros) return dados;
        if (!Array.isArray(filtros)) filtros = [filtros];
        if (!Array.isArray(parms)) parms = [parms];

        var tarefa = Promise.resolve(dados);
        filtros.forEach(function (f, idx) {
          var nome = ehNome(eu.pegar(f)) ? eu.pegar(f).nome : '';
          var pp = eu.dic(parms[idx]);
          tarefa = tarefa.then(function (dd) {
            if (nome === 'FlateDecode' || nome === 'Fl') {
              return inflar(dd).then(function (x) { return desprever(x, pp, function (v) { return eu.pegar(v); }); });
            }
            if (nome === 'LZWDecode' || nome === 'LZW') {
              var cedo = pp ? eu.pegar(pp.EarlyChange) : 1;
              return desprever(lzw(dd, cedo), pp, function (v) { return eu.pegar(v); });
            }
            if (nome === 'ASCIIHexDecode' || nome === 'AHx') return asciiHex(dd);
            if (nome === 'ASCII85Decode' || nome === 'A85') return ascii85(dd);
            if (nome === 'RunLengthDecode' || nome === 'RL') return runLength(dd);
            return dd; // imagem ou filtro que não interessa
          });
        });
        return tarefa;
      }).then(function (dados) {
        reg.pronto = dados;
        return dados;
      }).catch(function () { return new Uint8Array(0); });
    };

    // Objetos guardados dentro de outros objetos (comum em PDF novo).
    Documento.prototype.abrirObjStm = function () {
      var eu = this;
      var lista = [];
      Object.keys(this.objetos).forEach(function (num) {
        var reg = eu.objetos[num];
        var d = ehDic(reg.valor) ? reg.valor.dic : null;
        if (d && ehNome(eu.pegar(d.Type)) && eu.pegar(d.Type).nome === 'ObjStm') lista.push(Number(num));
      });

      var tarefa = Promise.resolve();
      lista.forEach(function (num) {
        tarefa = tarefa.then(function () {
          return eu.fluxo(num).then(function (dados) {
            var d = eu.objetos[num].valor.dic;
            var N = eu.pegar(d.N) || 0, primeiro = eu.pegar(d.First) || 0;
            var txt = textoDeBytes(dados);
            var cabeca = txt.slice(0, primeiro).trim().split(/\s+/);
            for (var i = 0; i < N; i++) {
              var alvo = parseInt(cabeca[i * 2], 10);
              var desloc = parseInt(cabeca[i * 2 + 1], 10);
              if (!isFinite(alvo) || !isFinite(desloc)) continue;
              if (eu.objetos[alvo] && eu.objetos[alvo].fluxoIni >= 0) continue;
              var lex = new Lex(txt, primeiro + desloc);
              var v;
              try { v = lex.valor(); } catch (e) { continue; }
              if (!eu.objetos[alvo]) eu.objetos[alvo] = { valor: v, ger: 0, fluxoIni: -1, fluxoFim: -1, num: alvo };
            }
          });
        });
      });
      return tarefa;
    };


    // 0x80-0x9F do WinAnsi, que é onde ele foge do latin-1.
    var WINANSI = { 128:0x20AC,130:0x201A,131:0x0192,132:0x201E,133:0x2026,134:0x2020,135:0x2021,
      136:0x02C6,137:0x2030,138:0x0160,139:0x2039,140:0x0152,142:0x017D,145:0x2018,146:0x2019,
      147:0x201C,148:0x201D,149:0x2022,150:0x2013,151:0x2014,152:0x02DC,153:0x2122,154:0x0161,
      155:0x203A,156:0x0153,158:0x017E,159:0x0178 };

    // Nomes de glifo que aparecem em /Differences num extrato.
    var GLIFOS = { space:32, exclam:33, quotedbl:34, numbersign:35, dollar:36, percent:37, ampersand:38,
      quotesingle:39, parenleft:40, parenright:41, asterisk:42, plus:43, comma:44, hyphen:45, period:46,
      slash:47, zero:48, one:49, two:50, three:51, four:52, five:53, six:54, seven:55, eight:56, nine:57,
      colon:58, semicolon:59, less:60, equal:61, greater:62, question:63, at:64, bracketleft:91,
      backslash:92, bracketright:93, asciicircum:94, underscore:95, grave:96, braceleft:123, bar:124,
      braceright:125, asciitilde:126, quotedblleft:0x201C, quotedblright:0x201D, quoteleft:0x2018,
      quoteright:0x2019, endash:0x2013, emdash:0x2014, bullet:0x2022, Euro:0x20AC, degree:0xB0,
      ccedilla:0xE7, Ccedilla:0xC7, aacute:0xE1, eacute:0xE9, iacute:0xED, oacute:0xF3, uacute:0xFA,
      atilde:0xE3, otilde:0xF5, acircumflex:0xE2, ecircumflex:0xEA, ocircumflex:0xF4, agrave:0xE0,
      Aacute:0xC1, Eacute:0xC9, Iacute:0xCD, Oacute:0xD3, Uacute:0xDA, Atilde:0xC3, Otilde:0xD5,
      Acircumflex:0xC2, Ecircumflex:0xCA, Ocircumflex:0xD4, Agrave:0xC0, ordfeminine:0xAA,
      ordmasculine:0xBA, sterling:0xA3, yen:0xA5, section:0xA7, paragraph:0xB6 };

    function letra(cod) {
      if (cod == null || cod < 0) return '';
      try { return String.fromCodePoint(cod); } catch (e) { return ''; }
    }

    // ---------- fontes ----------

    function lerToUnicode(txt) {
      var mapa = {}, m;
      var reChar = /beginbfchar([\s\S]*?)endbfchar/g;
      while ((m = reChar.exec(txt))) {
        var re1 = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g, p;
        while ((p = re1.exec(m[1]))) mapa[parseInt(p[1], 16)] = deHex(p[2]);
      }
      var reRange = /beginbfrange([\s\S]*?)endbfrange/g;
      while ((m = reRange.exec(txt))) {
        var corpo = m[1];
        var re2 = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<([0-9a-fA-F]*)>|\[([\s\S]*?)\])/g, r;
        while ((r = re2.exec(corpo))) {
          var de = parseInt(r[1], 16), ate = parseInt(r[2], 16);
          if (ate - de > 65535) continue;
          if (r[4] != null) {
            var baseHex = r[4];
            for (var c = de; c <= ate; c++) {
              var passo = c - de;
              mapa[c] = deHexComPasso(baseHex, passo);
            }
          } else if (r[5] != null) {
            var itens = r[5].match(/<([0-9a-fA-F]*)>/g) || [];
            for (var k = 0; k < itens.length && de + k <= ate; k++) {
              mapa[de + k] = deHex(itens[k].replace(/[<>]/g, ''));
            }
          }
        }
      }
      // quantos bytes por código
      var bytes = 1;
      var cs = /begincodespacerange([\s\S]*?)endcodespacerange/.exec(txt);
      if (cs) {
        var pri = /<([0-9a-fA-F]+)>/.exec(cs[1]);
        if (pri && pri[1].length >= 4) bytes = 2;
      }
      return { mapa: mapa, bytes: bytes };
    }

    function deHex(h) {
      if (!h) return '';
      var fora = '';
      for (var i = 0; i + 4 <= h.length; i += 4) {
        var v = parseInt(h.substr(i, 4), 16);
        if (v >= 0xD800 && v <= 0xDBFF && i + 8 <= h.length) {
          var baixo = parseInt(h.substr(i + 4, 4), 16);
          fora += String.fromCharCode(v, baixo);
          i += 4;
        } else fora += String.fromCharCode(v);
      }
      if (!fora && h.length >= 2) fora = String.fromCharCode(parseInt(h.substr(0, 2), 16));
      return fora;
    }

    function deHexComPasso(h, passo) {
      if (h.length <= 4) return String.fromCharCode((parseInt(h, 16) || 0) + passo);
      var cabeca = h.slice(0, h.length - 4);
      var cauda = parseInt(h.slice(-4), 16) + passo;
      return deHex(cabeca) + String.fromCharCode(cauda);
    }

    function lerFonte(doc, refFonte) {
      var d = doc.dic(refFonte);
      if (!d) return Promise.resolve({ bytes: 1, mapa: null, dif: null });

      var sub = doc.pegar(d.Subtype);
      var ehType0 = ehNome(sub) && sub.nome === 'Type0';
      var bytes = ehType0 ? 2 : 1;

      // /Differences do encoding
      var dif = null;
      var enc = doc.pegar(d.Encoding);
      if (enc && ehDic(enc)) {
        var lista = doc.pegar(enc.dic.Differences);
        if (Array.isArray(lista)) {
          dif = {};
          var atual = 0;
          lista.forEach(function (it) {
            var v = doc.pegar(it);
            if (typeof v === 'number') atual = v;
            else if (ehNome(v)) {
              var g = GLIFOS[v.nome];
              if (g == null) {
                var mu = /^uni([0-9A-Fa-f]{4})$/.exec(v.nome);
                if (mu) g = parseInt(mu[1], 16);
              }
              if (g == null && v.nome.length === 1) g = v.nome.charCodeAt(0);
              dif[atual] = g == null ? -1 : g;
              atual++;
            }
          });
        }
      } else if (ehNome(enc) && /Identity/.test(enc.nome)) bytes = 2;

      var tu = d.ToUnicode;
      if (!tu) return Promise.resolve({ bytes: bytes, mapa: null, dif: dif });
      var num = tu && typeof tu.ref === 'number' ? tu.ref : null;
      if (num == null) return Promise.resolve({ bytes: bytes, mapa: null, dif: dif });

      return doc.fluxo(num).then(function (dados) {
        var lido = lerToUnicode(textoDeBytes(dados));
        return { bytes: lido.bytes || bytes, mapa: lido.mapa, dif: dif };
      }).catch(function () { return { bytes: bytes, mapa: null, dif: dif }; });
    }

    function decodificar(fonte, bytes) {
      var fora = '';
      var passo = fonte.bytes === 2 ? 2 : 1;
      for (var i = 0; i < bytes.length; i += passo) {
        var cod = passo === 2 ? ((bytes[i] << 8) | (bytes[i + 1] || 0)) : bytes[i];
        if (fonte.mapa && fonte.mapa[cod] != null) { fora += fonte.mapa[cod]; continue; }
        if (fonte.dif && fonte.dif[cod] != null) { fora += letra(fonte.dif[cod]); continue; }
        if (passo === 2) { fora += letra(cod); continue; }
        fora += letra(WINANSI[cod] != null ? WINANSI[cod] : cod);
      }
      return fora;
    }

    // ---------- matrizes ----------

    function mult(a, b) {
      return [a[0]*b[0]+a[1]*b[2], a[0]*b[1]+a[1]*b[3],
              a[2]*b[0]+a[3]*b[2], a[2]*b[1]+a[3]*b[3],
              a[4]*b[0]+a[5]*b[2]+b[4], a[4]*b[1]+a[5]*b[3]+b[5]];
    }

    // ---------- percorrer o conteúdo ----------

    function lerConteudo(doc, dados, fontes) {
      var txt = textoDeBytes(dados);
      var lex = new Lex(txt, 0);
      var pilhaOp = [];
      var ctm = [1, 0, 0, 1, 0, 0], pilhaCtm = [];
      var tm = null, tlm = null;
      var fonte = { bytes: 1, mapa: null, dif: null }, tamanho = 12, avanco = 0, escalaH = 1, espacoPal = 0, espacoChar = 0;
      var pedacos = [];

      function posicao() {
        var m = mult(tm || [1,0,0,1,0,0], ctm);
        return { x: m[4], y: m[5], escala: Math.abs(m[3]) || Math.abs(m[0]) || 1 };
      }

      function mostrar(bytesTexto) {
        if (!tm) tm = [1,0,0,1,0,0];
        var s = decodificar(fonte, bytesTexto);
        if (!s) return;
        var p = posicao();
        pedacos.push({ x: p.x, y: p.y, t: s, tam: tamanho * (p.escala || 1) });
        // Avanço aproximado: serve só para saber que houve espaço entre colunas.
        var largura = s.length * tamanho * 0.5 * escalaH;
        tm = mult([1, 0, 0, 1, largura, 0], tm);
      }

      for (;;) {
        lex.pularBrancos();
        if (lex.i >= txt.length) break;
        var antes = lex.i;
        var v;
        try { v = lex.valor(); } catch (e) { break; }
        if (lex.i === antes) { lex.i++; continue; }
        if (v === undefined) continue;

        if (!(v && v.palavra)) { pilhaOp.push(v); if (pilhaOp.length > 64) pilhaOp.shift(); continue; }

        var op = v.palavra;
        var a = pilhaOp;

        if (op === 'q') { pilhaCtm.push(ctm.slice()); }
        else if (op === 'Q') { if (pilhaCtm.length) ctm = pilhaCtm.pop(); }
        else if (op === 'cm' && a.length >= 6) {
          var n6 = a.slice(-6).map(Number);
          if (n6.every(isFinite)) ctm = mult(n6, ctm);
        }
        else if (op === 'BT') { tm = [1,0,0,1,0,0]; tlm = tm.slice(); }
        else if (op === 'ET') { tm = null; }
        else if (op === 'Tf' && a.length >= 2) {
          var nf = a[a.length - 2];
          tamanho = Number(a[a.length - 1]) || 12;
          if (nf && nf.nome && fontes[nf.nome]) fonte = fontes[nf.nome];
        }
        else if (op === 'Td' && a.length >= 2) {
          tlm = mult([1,0,0,1, Number(a[a.length-2])||0, Number(a[a.length-1])||0], tlm || [1,0,0,1,0,0]);
          tm = tlm.slice();
        }
        else if (op === 'TD' && a.length >= 2) {
          avanco = -(Number(a[a.length-1]) || 0);
          tlm = mult([1,0,0,1, Number(a[a.length-2])||0, Number(a[a.length-1])||0], tlm || [1,0,0,1,0,0]);
          tm = tlm.slice();
        }
        else if (op === 'Tm' && a.length >= 6) {
          var m6 = a.slice(-6).map(Number);
          if (m6.every(isFinite)) { tlm = m6; tm = m6.slice(); }
        }
        else if (op === 'T*') {
          tlm = mult([1,0,0,1,0,-avanco], tlm || [1,0,0,1,0,0]);
          tm = tlm.slice();
        }
        else if (op === 'TL') { avanco = Number(a[a.length-1]) || 0; }
        else if (op === 'Tz') { escalaH = (Number(a[a.length-1]) || 100) / 100; }
        else if (op === 'Tc') { espacoChar = Number(a[a.length-1]) || 0; }
        else if (op === 'Tw') { espacoPal = Number(a[a.length-1]) || 0; }
        else if (op === 'Tj' && a.length) {
          var u = a[a.length-1];
          if (u && u.bytes) mostrar(u.bytes);
        }
        else if ((op === "'" || op === '"') && a.length) {
          tlm = mult([1,0,0,1,0,-avanco], tlm || [1,0,0,1,0,0]);
          tm = tlm.slice();
          var u2 = a[a.length-1];
          if (u2 && u2.bytes) mostrar(u2.bytes);
        }
        else if (op === 'TJ' && a.length) {
          var arr = a[a.length-1];
          if (Array.isArray(arr)) {
            arr.forEach(function (it) {
              if (it && it.bytes) mostrar(it.bytes);
              else if (typeof it === 'number') {
                var d = -it / 1000 * tamanho * escalaH;
                if (tm) tm = mult([1,0,0,1,d,0], tm);
                // Um recuo grande entre pedaços é espaço de verdade.
                if (it < -180 && pedacos.length) pedacos[pedacos.length-1].t += ' ';
              }
            });
          }
        }
        pilhaOp = [];
      }
      return pedacos;
    }

    // Junta os pedaços em linhas, pela altura, e ordena pela horizontal.
    function montarLinhas(pedacos) {
      if (!pedacos.length) return [];
      var ordem = pedacos.slice().sort(function (a, b) { return b.y - a.y || a.x - b.x; });
      var linhas = [], atual = null;
      ordem.forEach(function (p) {
        var tol = Math.max(2, (p.tam || 8) * 0.45);
        if (!atual || Math.abs(atual.y - p.y) > tol) {
          atual = { y: p.y, itens: [] };
          linhas.push(atual);
        }
        atual.itens.push(p);
      });
      return linhas.map(function (l) {
        var itens = l.itens.sort(function (a, b) { return a.x - b.x; });
        if (itens.length === 1) return itens[0].t.trim();

        // Quanto anda um caractere nesta linha, medido nas próprias posições.
        // Estimar por um fator fixo enfiava espaço no meio das palavras, porque
        // letra larga (O, M, G) anda bem mais do que a média.
        var passos = [];
        for (var i = 1; i < itens.length; i++) {
          var n = Math.max(1, itens[i - 1].t.length);
          var d = itens[i].x - itens[i - 1].x;
          if (d > 0) passos.push(d / n);
        }
        passos.sort(function (a, b) { return a - b; });
        var unidade = passos.length ? passos[Math.floor(passos.length / 2)] : 0;

        // Quando cada coluna é um pedaço só, todo passo já traz o vão da coluna
        // embutido e a mediana estoura. O corpo da letra é o teto: nenhuma
        // fonte anda mais do que isso por caractere, em média.
        var tams = itens.map(function (p) { return p.tam || 8; }).sort(function (a, b) { return a - b; });
        var teto = tams[Math.floor(tams.length / 2)] * 0.62;
        if (!(unidade > 0) || unidade > teto) unidade = teto;
        if (!(unidade > 0)) unidade = 4;

        // Se o próprio PDF já escreve os espaços, só marco as colunas. Se ele
        // não escreve nenhum, aí sim preciso adivinhar onde a palavra acaba.
        var temEspaco = itens.some(function (p) { return /\s/.test(p.t); });
        var limite = temEspaco ? 1.6 : 0.45;

        var fora = itens[0].t;
        for (var k = 1; k < itens.length; k++) {
          var ant = itens[k - 1];
          var sobra = (itens[k].x - ant.x) - ant.t.length * unidade;
          if (sobra > unidade * limite && !/\s$/.test(fora)) fora += ' ';
          fora += itens[k].t;
        }
        return fora.replace(/\s+/g, ' ').trim();
      }).filter(function (s) { return s; });
    }

    // ---------- porta de entrada ----------

    function extrair(bytes, senha) {
      var doc = new Documento(bytes);
      doc.varrer();
      return doc.prepararCifra(senha).then(function (r) {
        if (!r.ok) return { precisaSenha: true, linhas: [] };
        return doc.abrirObjStm().then(function () {
          // As páginas, na ordem em que aparecem.
          var paginas = [];
          Object.keys(doc.objetos).map(Number).sort(function (a, b) { return a - b; }).forEach(function (num) {
            var reg = doc.objetos[num];
            var d = ehDic(reg.valor) ? reg.valor.dic : null;
            if (!d) return;
            var t = doc.pegar(d.Type);
            if (ehNome(t) && t.nome === 'Page') paginas.push({ num: num, dic: d });
          });

          var linhas = [];
          var tarefa = Promise.resolve();
          paginas.forEach(function (pg) {
            tarefa = tarefa.then(function () {
              // fontes da página
              var rec = doc.dic(pg.dic.Resources) || {};
              var fdic = doc.dic(rec.Font) || {};
              var fontes = {};
              var t2 = Promise.resolve();
              Object.keys(fdic).forEach(function (chave) {
                t2 = t2.then(function () {
                  return lerFonte(doc, fdic[chave]).then(function (f) { fontes[chave] = f; });
                });
              });

              return t2.then(function () {
                var cont = doc.pegar(pg.dic.Contents);
                var nums = [];
                if (pg.dic.Contents && typeof pg.dic.Contents.ref === 'number') nums.push(pg.dic.Contents.ref);
                else if (Array.isArray(pg.dic.Contents)) {
                  pg.dic.Contents.forEach(function (c) { if (c && typeof c.ref === 'number') nums.push(c.ref); });
                }
                var partes = [];
                var t3 = Promise.resolve();
                nums.forEach(function (n) {
                  t3 = t3.then(function () { return doc.fluxo(n).then(function (b) { partes.push(b); }); });
                });
                return t3.then(function () {
                  if (!partes.length) return;
                  var tudo = juntar(partes.map(function (b, i) {
                    return i ? juntar([bytesDeTexto('\n'), b]) : b;
                  }));
                  var pedacos = lerConteudo(doc, tudo, fontes);
                  montarLinhas(pedacos).forEach(function (l) { linhas.push(l); });
                });
              });
            });
          });
          return tarefa.then(function () { return { precisaSenha: false, linhas: linhas, paginas: paginas.length }; });
        });
      });
    }


    // ---------- ZIP ----------
    // Um .xlsx é um zip com XML dentro. Só preciso dos arquivos que interessam.

    function lerZip(bytes) {
      var n = bytes.length;
      // Fim do diretório central: assinatura 0x06054b50, perto do fim.
      var fim = -1;
      for (var i = n - 22; i >= 0 && i > n - 66000; i--) {
        if (bytes[i] === 0x50 && bytes[i+1] === 0x4B && bytes[i+2] === 0x05 && bytes[i+3] === 0x06) { fim = i; break; }
      }
      if (fim < 0) return null;

      var v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      var quantos = v.getUint16(fim + 10, true);
      var inicio = v.getUint32(fim + 16, true);
      var arquivos = {};
      var p = inicio;

      for (var k = 0; k < quantos && p + 46 <= n; k++) {
        if (v.getUint32(p, true) !== 0x02014b50) break;
        var metodo = v.getUint16(p + 10, true);
        var comprimido = v.getUint32(p + 20, true);
        var cru = v.getUint32(p + 24, true);
        var tamNome = v.getUint16(p + 28, true);
        var tamExtra = v.getUint16(p + 30, true);
        var tamCom = v.getUint16(p + 32, true);
        var local = v.getUint32(p + 42, true);
        var nome = new TextDecoder('utf-8').decode(bytes.subarray(p + 46, p + 46 + tamNome));
        arquivos[nome] = { metodo: metodo, comprimido: comprimido, cru: cru, local: local };
        p += 46 + tamNome + tamExtra + tamCom;
      }
      return { bytes: bytes, v: v, arquivos: arquivos };
    }

    function tirarDoZip(zip, nome) {
      var e = zip.arquivos[nome];
      if (!e) return Promise.resolve(null);
      var v = zip.v, p = e.local;
      if (v.getUint32(p, true) !== 0x04034b50) return Promise.resolve(null);
      var tamNome = v.getUint16(p + 26, true);
      var tamExtra = v.getUint16(p + 28, true);
      var ini = p + 30 + tamNome + tamExtra;
      var dados = zip.bytes.subarray(ini, ini + e.comprimido);
      if (e.metodo === 0) return Promise.resolve(dados);
      if (e.metodo !== 8) return Promise.resolve(null);
      return inflar(dados, true).then(function (b) { return b && b.length ? b : null; });
    }

    // ---------- XML ----------

    function destrocar(t) {
      return String(t == null ? '' : t)
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#x([0-9a-fA-F]+);/g, function (m, h) { return String.fromCodePoint(parseInt(h, 16)); })
        .replace(/&#(\d+);/g, function (m, d) { return String.fromCodePoint(+d); })
        .replace(/&amp;/g, '&');
    }

    function textoDeXml(trecho) {
      var fora = '', re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g, m;
      while ((m = re.exec(trecho))) fora += destrocar(m[1]);
      return fora;
    }

    // ---------- datas ----------

    // O Excel guarda data como número de dias desde 1900, com o bug do ano
    // bissexto de 1900 embutido. Por isso a base é 30/12/1899.
    function dataDeSerial(n) {
      if (!(n > 0) || n > 2958465) return '';
      var ms = Math.round((n - 25569) * 86400000);
      var d = new Date(ms);
      if (isNaN(d.getTime())) return '';
      return d.getUTCFullYear() + '-' +
        String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
        String(d.getUTCDate()).padStart(2, '0');
    }

    var FORMATOS_DATA = { 14:1, 15:1, 16:1, 17:1, 18:1, 19:1, 20:1, 21:1, 22:1, 45:1, 46:1, 47:1 };

    function estilosDeData(xml) {
      if (!xml) return {};
      var proprios = {};
      var re = /<numFmt[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g, m;
      while ((m = re.exec(xml))) {
        var cod = destrocar(m[2]);
        // Um formato com dia, mês ou ano e sem aspas é data.
        if (/[dmyDMY]/.test(cod.replace(/"[^"]*"/g, '')) && !/^[^dmyDMY]*$/.test(cod)) proprios[m[1]] = 1;
      }
      var bloco = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xml);
      if (!bloco) return {};
      var mapa = {}, idx = 0;
      var reXf = /<xf\b([^>]*)\/?>/g, x;
      while ((x = reXf.exec(bloco[1]))) {
        var id = /numFmtId="(\d+)"/.exec(x[1]);
        if (id && (FORMATOS_DATA[+id[1]] || proprios[id[1]])) mapa[idx] = 1;
        idx++;
      }
      return mapa;
    }

    // ---------- planilha ----------

    function coluna(ref) {
      var m = /^([A-Z]+)/.exec(ref || '');
      if (!m) return 0;
      var n = 0;
      for (var i = 0; i < m[1].length; i++) n = n * 26 + (m[1].charCodeAt(i) - 64);
      return n - 1;
    }

    function lerPlanilha(xml, textos, datas) {
      var linhas = [];
      var reLinha = /<row\b[^>]*>([\s\S]*?)<\/row>|<row\b[^>]*\/>/g, ml;
      while ((ml = reLinha.exec(xml))) {
        var corpo = ml[1] || '';
        var celulas = [];
        var reCel = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, mc;
        while ((mc = reCel.exec(corpo))) {
          var attrs = mc[1] || '', dentro = mc[2] || '';
          var refm = /r="([A-Z]+\d+)"/.exec(attrs);
          var col = refm ? coluna(refm[1]) : celulas.length;
          var tipo = (/t="([^"]*)"/.exec(attrs) || [])[1] || 'n';
          var estilo = +((/s="(\d+)"/.exec(attrs) || [])[1] || -1);

          var valor = '';
          if (tipo === 's') {
            var iv = /<v>([\s\S]*?)<\/v>/.exec(dentro);
            valor = iv ? (textos[+iv[1]] || '') : '';
          } else if (tipo === 'inlineStr') {
            valor = textoDeXml(dentro);
          } else if (tipo === 'str') {
            var sv = /<v>([\s\S]*?)<\/v>/.exec(dentro);
            valor = sv ? destrocar(sv[1]) : '';
          } else {
            var nv = /<v>([\s\S]*?)<\/v>/.exec(dentro);
            if (nv) {
              var num = parseFloat(nv[1]);
              if (datas[estilo] && isFinite(num)) valor = dataDeSerial(num);
              else if (isFinite(num)) {
                // Guardo com vírgula, que é como o resto do app lê dinheiro.
                valor = (Math.round(num * 100) / 100).toFixed(2).replace('.', ',');
              } else valor = nv[1];
            }
          }
          while (celulas.length < col) celulas.push('');
          celulas[col] = valor;
        }
        if (celulas.length) linhas.push(celulas);
      }
      return linhas;
    }

    function lerXlsx(bytes) {
      var zip = lerZip(bytes);
      if (!zip) return Promise.resolve(null);

      var textos = [], datas = {}, folhas = [];
      return tirarDoZip(zip, 'xl/sharedStrings.xml').then(function (b) {
        if (!b) return;
        var xml = new TextDecoder('utf-8').decode(b);
        var re = /<si\b[^>]*>([\s\S]*?)<\/si>/g, m;
        while ((m = re.exec(xml))) textos.push(textoDeXml(m[1]));
      }).then(function () {
        return tirarDoZip(zip, 'xl/styles.xml');
      }).then(function (b) {
        if (b) datas = estilosDeData(new TextDecoder('utf-8').decode(b));
      }).then(function () {
        // Todas as abas, na ordem dos arquivos.
        var nomes = Object.keys(zip.arquivos).filter(function (n) {
          return /^xl\/worksheets\/sheet\d+\.xml$/.test(n);
        }).sort(function (a, b) {
          return (+/(\d+)/.exec(a)[1]) - (+/(\d+)/.exec(b)[1]);
        });
        var tarefa = Promise.resolve();
        nomes.forEach(function (n) {
          tarefa = tarefa.then(function () {
            return tirarDoZip(zip, n).then(function (b) {
              if (!b) return;
              folhas.push(lerPlanilha(new TextDecoder('utf-8').decode(b), textos, datas));
            });
          });
        });
        return tarefa;
      }).then(function () {
        var tudo = [];
        folhas.forEach(function (f) { f.forEach(function (l) { tudo.push(l); }); });
        return tudo;
      });
    }


    var MESES = { jan:1, fev:2, mar:3, abr:4, mai:5, jun:6, jul:7, ago:8, set:9, out:10, nov:11, dez:12,
                  janeiro:1, fevereiro:2, marco:3, abril:4, maio:5, junho:6, julho:7, agosto:8,
                  setembro:9, outubro:10, novembro:11, dezembro:12 };

    function semAcento(t) {
      return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    }

    function doisDigitos(n) { return (n < 10 ? '0' : '') + n; }

    function montarData(dia, mes, ano) {
      if (!(dia >= 1 && dia <= 31) || !(mes >= 1 && mes <= 12)) return '';
      if (ano < 100) ano += ano > 70 ? 1900 : 2000;
      if (!(ano >= 1990 && ano <= 2100)) return '';
      return ano + '-' + doisDigitos(mes) + '-' + doisDigitos(dia);
    }

    // Acha a primeira data da linha e devolve onde ela termina.
    function acharData(linha, anoPadrao) {
      var m = /(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})/.exec(linha);
      if (m) return { data: montarData(+m[1], +m[2], +m[3]), fim: m.index + m[0].length, ini: m.index };
      m = /(\d{4})-(\d{2})-(\d{2})/.exec(linha);
      if (m) return { data: montarData(+m[3], +m[2], +m[1]), fim: m.index + m[0].length, ini: m.index };
      m = /(\d{1,2})\s+de\s+([a-zA-ZçÇãÃéÉêÊúÚíÍóÓâÂ]+)\s+de\s+(\d{4})/.exec(linha);
      if (m && MESES[semAcento(m[2])]) {
        return { data: montarData(+m[1], MESES[semAcento(m[2])], +m[3]), fim: m.index + m[0].length, ini: m.index };
      }
      m = /(\d{1,2})\s+([a-zA-ZçÇãÃéÉêÊúÚíÍóÓâÂ]{3,9})\.?\s+(\d{4})/.exec(linha);
      if (m && MESES[semAcento(m[2]).slice(0, 3)]) {
        return { data: montarData(+m[1], MESES[semAcento(m[2]).slice(0, 3)], +m[3]), fim: m.index + m[0].length, ini: m.index };
      }
      // Sem ano: comum no C6, que põe o ano só no cabeçalho do mês.
      m = /(^|\s)(\d{1,2})\/(\d{1,2})(?!\/|\d)/.exec(linha);
      if (m && anoPadrao) {
        return { data: montarData(+m[2], +m[3], anoPadrao), fim: m.index + m[0].length,
                 ini: m.index + m[1].length, semAno: true, dia: +m[2], mes: +m[3] };
      }
      return null;
    }


    // Bancos que dá para reconhecer pelo texto do arquivo. A cor é a da marca,
    // clareada quando precisa, porque o app é escuro. A marca é um monograma
    // desenhado aqui: não uso o logotipo de ninguém.
    var BANCOS = [
      { chave: 'c6',        nome: 'C6 Bank',        cor: '#D9D9D9', marca: 'C6',
        apelidos: [/\bc6\b/],
        pistas: [/\bbanco c6\b/, /\bc6 bank\b/, /\bc6bank\b/, /cartao c6/, /\bc6\s*(s\.?a\.?)\b/] },
      { chave: 'nubank',    nome: 'Nubank',         cor: '#A855F7', marca: 'Nu',
        apelidos: [/\bnu\b/, /\bnubank\b/],
        pistas: [/\bnubank\b/, /\bnu pagamentos\b/, /\bnu financeira\b/, /\bnuconta\b/] },
      { chave: 'itau',      nome: 'Itaú',           cor: '#F58220', marca: 'It',
        apelidos: [/\bitau\b/],
        pistas: [/\bitau\b/, /\bitau unibanco\b/, /\bitaucard\b/] },
      { chave: 'bradesco',  nome: 'Bradesco',       cor: '#E8455F', marca: 'Bra',
        apelidos: [/\bbra\b/, /\bbradesco\b/],
        pistas: [/\bbradesco\b/, /\bbradescard\b/, /\bnext\b/] },
      { chave: 'bb',        nome: 'Banco do Brasil', cor: '#F2D64B', marca: 'BB',
        apelidos: [/\bbb\b/],
        pistas: [/\bbanco do brasil\b/, /\bbb\.com\.br\b/, /\bourocard\b/] },
      { chave: 'caixa',     nome: 'Caixa',          cor: '#3BAEE0', marca: 'CX',
        apelidos: [/\bcaixa\b/, /\bcef\b/],
        pistas: [/\bcaixa economica\b/, /\bcaixa economica federal\b/, /\bcef\b/] },
      { chave: 'santander', nome: 'Santander',      cor: '#FF5A5A', marca: 'St',
        apelidos: [/\bsant\b/],
        pistas: [/\bsantander\b/, /\bsx\b.*santander/] },
      { chave: 'inter',     nome: 'Banco Inter',    cor: '#FF8A2B', marca: 'In',
        apelidos: [/\binter\b/],
        pistas: [/\bbanco inter\b/, /\binter\b(?!net)/] },
      { chave: 'sicredi',   nome: 'Sicredi',        cor: '#5CC22A', marca: 'Si',
        apelidos: [/\bsicredi\b/],
        pistas: [/\bsicredi\b/] },
      { chave: 'sicoob',    nome: 'Sicoob',         cor: '#2BC4B4', marca: 'Sc',
        apelidos: [/\bsicoob\b/],
        pistas: [/\bsicoob\b/] },
      { chave: 'picpay',    nome: 'PicPay',         cor: '#3FD07A', marca: 'PP',
        apelidos: [/\bpicpay\b/],
        pistas: [/\bpicpay\b/] },
      { chave: 'mercadopago', nome: 'Mercado Pago', cor: '#3BB9EF', marca: 'MP',
        apelidos: [/\bmp\b/, /\bmercadopago\b/],
        pistas: [/\bmercado pago\b/, /\bmercadopago\b/] },
      { chave: 'pagbank',   nome: 'PagBank',        cor: '#3FD07A', marca: 'PB',
        apelidos: [/\bpagbank\b/, /\bpagseguro\b/],
        pistas: [/\bpagbank\b/, /\bpagseguro\b/] },
      { chave: 'neon',      nome: 'Neon',           cor: '#2FE3D0', marca: 'Ne',
        apelidos: [/\bneon\b/],
        pistas: [/\bbanco neon\b/, /\bneon pagamentos\b/] },
      { chave: 'will',      nome: 'Will Bank',      cor: '#FFD84D', marca: 'Wi',
        apelidos: [/\bwill\b/],
        pistas: [/\bwill bank\b/, /\bwillbank\b/] },
      { chave: 'btg',       nome: 'BTG Pactual',    cor: '#6BA7DF', marca: 'BT',
        apelidos: [/\bbtg\b/],
        pistas: [/\bbtg pactual\b/, /\bbtg\b/] },
      { chave: 'xp',        nome: 'XP',             cor: '#E4E4E4', marca: 'XP',
        apelidos: [/\bxp\b/],
        pistas: [/\bxp investimentos\b/, /\bbanco xp\b/] },
      { chave: 'original',  nome: 'Banco Original', cor: '#3FD08F', marca: 'Or',
        apelidos: [/\boriginal\b/],
        pistas: [/\bbanco original\b/] },
      { chave: 'safra',     nome: 'Safra',          cor: '#7FA8D4', marca: 'Sa',
        apelidos: [/\bsafra\b/],
        pistas: [/\bbanco safra\b/, /\bsafra\b/] },
      { chave: 'banrisul',  nome: 'Banrisul',       cor: '#5B95D6', marca: 'Ba',
        apelidos: [/\bbanrisul\b/],
        pistas: [/\bbanrisul\b/] },
      { chave: 'pan',       nome: 'Banco Pan',      cor: '#4FC3F7', marca: 'Pa',
        apelidos: [/\bpan\b/],
        pistas: [/\bbanco pan\b/] },
      { chave: 'agibank',   nome: 'Agibank',        cor: '#FF9A3D', marca: 'Ag',
        apelidos: [/\bagibank\b/],
        pistas: [/\bagibank\b/] },
      { chave: 'digio',     nome: 'Digio',          cor: '#5CD6E8', marca: 'Di',
        apelidos: [/\bdigio\b/],
        pistas: [/\bdigio\b/] },
      { chave: 'brb',       nome: 'BRB',            cor: '#5BB8E8', marca: 'BR',
        apelidos: [/\bbrb\b/],
        pistas: [/\bbrb\b/, /banco de brasilia/] }
    ];

    function soBanco(b) {
      return { chave: b.chave, nome: b.nome, cor: b.cor, marca: b.marca };
    }

    function acharBanco(texto, nomeArquivo) {
      // "fatura_c6_2026-08.csv": traço e sublinhado viram espaço, senão o \b
      // do regex não enxerga a palavra no meio do nome do arquivo.
      var arq = semAcento(nomeArquivo || '').replace(/[._\-+()]+/g, ' ');
      if (arq) {
        for (var i = 0; i < BANCOS.length; i++) {
          var b = BANCOS[i];
          var lista = (b.apelidos || []).concat(b.pistas);
          for (var k = 0; k < lista.length; k++) if (lista[k].test(arq)) return soBanco(b);
        }
      }

      var s = semAcento(texto).slice(0, 40000);
      var melhor = null, melhorPos = Infinity;
      BANCOS.forEach(function (b) {
        b.pistas.forEach(function (re) {
          var m = re.exec(s);
          // Quem aparece mais no começo do arquivo é quem emitiu ele.
          if (m && m.index < melhorPos) { melhorPos = m.index; melhor = b; }
        });
      });
      return melhor ? soBanco(melhor) : null;
    }

    function bancoPorChave(chave) {
      for (var i = 0; i < BANCOS.length; i++) if (BANCOS[i].chave === chave) return BANCOS[i];
      return null;
    }

    function listaDeBancos() {
      return BANCOS.map(function (b) {
        return { chave: b.chave, nome: b.nome, cor: b.cor, marca: b.marca };
      });
    }

    // Fatura de cartão: quase tudo é gasto, mesmo sem sinal de menos na frente.
    var PISTAS_FATURA = [
      /fatura/, /cartao de credito/, /\blimite (total|disponivel|de credito)\b/,
      /vencimento da fatura/, /total da fatura/, /melhor dia de compra/,
      /lancamentos (nacionais|internacionais)/, /pagamento minimo/, /fatura anterior/
    ];

    function pareceFatura(texto, nomeArquivo) {
      var arq = semAcento(nomeArquivo || '');
      // "fatura-2026-08.csv" já entrega o jogo, mesmo sem nada escrito dentro.
      if (/fatura|invoice|cartao|credito/.test(arq)) return true;
      if (/extrato|conta.corrente|account/.test(arq)) return false;
      var s = semAcento(texto).slice(0, 20000);
      var pontos = 0;
      PISTAS_FATURA.forEach(function (re) { if (re.test(s)) pontos++; });
      return pontos >= 2;
    }

    // Numa fatura, isso é crédito: abate, não soma.
    var CREDITO_NA_FATURA = /(pagamento (recebido|efetuado|de fatura)|estorno|credito de|devolucao|cashback|desconto|ajuste a credito|anuidade diferenciada|reembolso)/;

    // Extrato que agrupa por dia (Inter, entre outros) põe a data numa linha
    // sozinha e deixa os lançamentos do dia embaixo, sem data nenhuma.
    function dataDeCabecalhoDeDia(linha) {
      var s = String(linha || '').trim();
      if (s.length > 90) return '';
      var m = /^(\d{1,2})\s+de\s+([a-zA-ZçÇãÃéÉêÊúÚíÍóÓâÂ]+)\s+de\s+(\d{4})\b/.exec(s);
      if (m && MESES[semAcento(m[2])]) return montarData(+m[1], MESES[semAcento(m[2])], +m[3]);
      // "26/12/2024" sozinho, ou seguido de "Saldo do dia"
      m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\b/.exec(s);
      if (m && /^\s*(saldo|$)/i.test(s.slice(m[0].length).replace(/[·\-–—]/g, ' '))) {
        return montarData(+m[1], +m[2], +m[3]);
      }
      return '';
    }

    // Uma coluna de saldo depois do valor engana quem pega o último número
    // da linha. Quando o extrato tem essa coluna, o valor é o penúltimo.
    function temColunaDeSaldo(texto) {
      var s = semAcento(texto).slice(0, 30000);
      return /saldo\s*(por\s*transacao|apos|posterior|resultante)/.test(s) ||
             /\bvalor\b[^\n]{0,40}\bsaldo\b/.test(s);
    }

    function comSinal(v) { return v.negativo ? -v.valor : v.valor; }

    // A última coluna é o saldo da conta ou o valor do lançamento? Errar aqui
    // troca o valor pelo saldo e o extrato inteiro sai errado. O cabeçalho não
    // serve de prova: cada banco escreve de um jeito e às vezes ele nem sai
    // numa linha só. Então eu faço a conta. Num extrato com saldo corrente,
    // saldo de uma linha menos o da linha anterior é o valor daquela linha.
    function pareceColunaDeSaldo(candidatos) {
      var testes = 0, acertos = 0;
      for (var i = 1; i < candidatos.length; i++) {
        var a = candidatos[i - 1].valores, b = candidatos[i].valores;
        if (a.length < 2 || b.length < 2) continue;
        var passo = comSinal(b[b.length - 1]) - comSinal(a[a.length - 1]);
        var valor = comSinal(b[b.length - 2]);
        testes++;
        if (passo !== 0 && Math.abs(passo) === Math.abs(valor)) acertos++;
      }
      return testes >= 3 && acertos >= testes * 0.6;
    }

    var RE_VALOR = /(-|\+)?\s*R?\$?\s*(-)?\s*(\d{1,3}(?:\.\d{3})+|\d+),(\d{2})(?!\d)/g;

    function acharValores(linha) {
      RE_VALOR.lastIndex = 0;
      var achados = [], m;
      while ((m = RE_VALOR.exec(linha))) {
        var inteiro = m[3].replace(/\./g, '');
        var centavos = parseInt(inteiro, 10) * 100 + parseInt(m[4], 10);
        if (!isFinite(centavos)) continue;
        var negativo = m[1] === '-' || m[2] === '-';
        achados.push({ valor: centavos, negativo: negativo, ini: m.index, fim: m.index + m[0].length });
      }
      return achados;
    }

    var PULAR = [
      /saldo\s+(do\s+dia|anterior|final|em|atual|disponivel|total|inicial)/,
      /^saldo\b/, /\bsaldo\s+do\s+dia\b/,
      /^total\b/, /^subtotal\b/, /^entradas?:/, /^saidas?:/,
      /^data\b.*\bvalor$/, /^periodo\b/, /^extrato\b/, /^pagina\b/, /^lancamentos?$/,
      /^descricao\b/, /^resumo\b/, /^agencia\b/, /^conta\b.*\bagencia\b/,
      /^(cpf|cnpj)\b/, /^banco\b/, /^cliente:/, /^titular/, /^s\.?a\.?$/,
      /^saldo/, /nao ha lancamentos/, /^continua/, /^transporte de saldo/,
      // resumo de fatura de cartão
      /total da fatura/, /vencimento (da fatura|em)/, /\blimite (total|disponivel|de credito)\b/,
      /pagamento minimo/, /fatura anterior/, /melhor dia/, /^encargos/, /^juros do rotativo/,
      /^valor total\b/, /^total a pagar/, /^total de compras/
    ];

    function devePular(linha) {
      var s = semAcento(linha).trim();
      if (!s) return true;
      // Cabeçalho de mês com o resumo do período: "Setembro 2025 (...) Entradas: ... Saídas: ..."
      if (/entradas?\s*:/.test(s) && /saidas?\s*:/.test(s)) return true;
      if (/^[a-z]+\s+\d{4}\s*\(/.test(s)) return true;
      for (var i = 0; i < PULAR.length; i++) if (PULAR[i].test(s)) return true;
      return false;
    }

    // A coluna "Tipo" do extrato já diz se entrou ou saiu. Tirar ela da
    // descrição deixa o lançamento com a cara do que a pessoa reconhece.
    var TIPOS_COLUNA = [
      [/^saida\s+(pix|ted|doc|transferencia)\b/, 'saida'],
      [/^entrada\s+(pix|ted|doc|transferencia)\b/, 'entrada'],
      [/^(debito de cartao|debito automatico|debito)\b/, 'saida'],
      [/^(outros gastos|pagamentos?|saidas?)\b/, 'saida'],
      [/^(entradas?|creditos?|deposito|rendimentos?|estorno)\b/, 'entrada']
    ];

    // Só é coluna quando o que vem depois começa outra frase. "Pagamento de
    // boleto" é descrição inteira; "Pagamento  PGTO FAT CARTAO" é coluna.
    var LIGACAO = /^(de|do|da|dos|das|no|na|nos|nas|em|para|por|com|pelo|pela|ao|a|o)\b/;

    // Particípio também continua a frase: "Pagamento efetuado CESUMAR" é uma
    // descrição só, não a coluna "Pagamento" seguida de outra coisa.
    var CONTINUACAO = /^\S*(ado|ada|ados|adas|ido|ida|idos|idas)\b/;

    function tirarColunaTipo(descricao) {
      var s = semAcento(descricao);
      for (var i = 0; i < TIPOS_COLUNA.length; i++) {
        var m = TIPOS_COLUNA[i][0].exec(s);
        if (!m) continue;
        var sobra = descricao.slice(m[0].length).replace(/^[\s:–—-]+/, '');
        if (sobra.length < 3) return { descricao: descricao, tipo: TIPOS_COLUNA[i][1] };
        var sobraSem = semAcento(sobra);
        if (LIGACAO.test(sobraSem) || CONTINUACAO.test(sobraSem)) {
          return { descricao: descricao, tipo: TIPOS_COLUNA[i][1] };
        }
        return { descricao: sobra, tipo: TIPOS_COLUNA[i][1] };
      }
      return null;
    }

    // O Inter põe o texto do Pix entre aspas e com o identificador da chave na
    // frente: Pix enviado: "Cp :31872495-FULANO". Quem lê só quer o nome.
    function arrumarDescricao(texto) {
      var s = String(texto || '').replace(/[\u201c\u201d\u201e]/g, '"').replace(/"/g, ' ');
      s = s.replace(/(^|:)\s*cp\s*:?\s*\d+\s*-\s*/gi, '$1 ');
      s = s.replace(/(^|:)\s*(?:\d{4,}[\s-]+){1,3}(?=\D)/g, '$1 ');
      s = s.replace(/\s{2,}/g, ' ').trim();
      // O Inter repete o tipo: a coluna diz "Pix enviado" e o detalhe começa
      // com "Pix enviado:" de novo. Fica uma vez só.
      var rep = /^(.{5,40}?)\s*[:\u2013\u2014-]?\s+\1\b/i.exec(s);
      if (rep) s = s.slice(rep[1].length).replace(/^\s*[:\u2013\u2014-]?\s*/, '');
      return s.replace(/\s{2,}/g, ' ').replace(/^[-\u2013\u2014:\s]+|[-\u2013\u2014:\s]+$/g, '');
    }

    var SAIDA = /(enviad|pagament|pagto|compra|debito|saida|saque|tarifa|taxa|iof|juros|anuidade|boleto|fatura|transferencia enviada|ted enviad|doc enviad|cobranca|desconto|aplicacao)/;
    var ENTRADA = /(recebid|entrada|credito|salario|rendiment|deposito|estorno|resgate|reembolso|devolucao|transferencia recebida|ted recebid|doc recebid|provento|cashback|premio)/;

    var CATEGORIA_POR_PALAVRA = [
      [/(\bposto|combustivel|gasolina|etanol|ipiranga|shell|petrobras|br distribuidora|ale combust)/, 'Combustível'],
      [/(uber|99app|99 tecnologia|cabify|taxi|onibus|metro|passagem|estacionamento|pedagio|sem parar|conectcar)/, 'Transporte'],
      [/(supermercado|\bmercado(?! ?(livre|pago|libre))|atacad|carrefour|assai|\bbig\b|zaffari|\bsuper(?!ior|vis|intend)|hortifrut|acougue|sacolao)/, 'Mercado'],
      [/(restaurante|lanchonete|padaria|pizzar|burger|mc ?donalds|bk |subway|ifood|rappi|cafe|bar |churrasc)/, 'Alimentação'],
      [/(farmacia|drogaria|droga ?raia|panvel|pague menos|hospital|clinica|laboratorio|unimed|amil|dentist|medic|psicolog)/, 'Saúde'],
      [/(escola|colegio|faculdade|universidade|cesumar|uniasselvi|estacio|curso|udemy|alura|ensino superior|mensalidade escolar)/, 'Educação'],
      [/(netflix|spotify|amazon prime|disney|hbo|max |globoplay|youtube premium|deezer|assinatura|apple.com|google ?one|microsoft)/, 'Assinaturas'],
      [/(cinema|teatro|show|ingresso|steam|playstation|xbox|nintendo|viagem|hotel|pousada|airbnb|booking)/, 'Lazer'],
      [/(aluguel|condominio|imobiliaria|energia|luz |cemig|copel|celesc|rge |cpfl|enel|agua|sanepar|corsan|sabesp|gas |internet|vivo|claro|tim |oi fixo|net )/, 'Moradia'],
      [/(peca|auto ?peca|autopeca|latoari|latarias|demolidora|retifica|pneu|borracharia)/, 'Peças'],
      [/(oficina|mecanic|funilaria|auto center|autocenter|garra auto|revisao)/, 'Manutenção'],
      [/(ferramenta|parafuso|material de construcao|construcao|home center|leroy|telha norte)/, 'Ferramentas'],
      [/(magalu|magazine|americanas|shopee|mercado ?livre|aliexpress|shein|amazon|casas bahia|renner|riachuelo)/, 'Casa'],
      [/(imposto|darf|das |gps |inss|iptu|ipva|receita federal|prefeitura|detran|licenciamento)/, 'Impostos'],
      [/(aplicacao|investiment|tesouro|cdb|lci|lca|corretora|xp |rico |clear|nuinvest|btg)/, 'Investimentos'],
      [/(iof|tarifa|anuidade|juros|multa|encargo|cesta)/, 'Impostos']
    ];

    var CATEGORIA_ENTRADA = [
      [/(salario|folha|pagamento de salario|holerite|adiantamento|13o|ferias)/, 'Salário'],
      [/(rendiment|juros|cashback|dividendo|provento|remuneracao de saldo|resgate)/, 'Rendimentos'],
      [/(uber|99app|99 tecnologia)/, 'Uber'],
      [/(oficina|mecanic|funilaria)/, 'Oficina'],
      [/(freela|servico|prestacao)/, 'Serviços'],
      [/(venda|pix recebido|transferencia recebida|ted recebid)/, 'Venda']
    ];

    function categoriaDe(descricao, tipo) {
      var s = semAcento(descricao);
      var tabela = tipo === 'entrada' ? CATEGORIA_ENTRADA : CATEGORIA_POR_PALAVRA;
      for (var i = 0; i < tabela.length; i++) if (tabela[i][0].test(s)) return tabela[i][1];
      return tipo === 'entrada' ? 'Outros' : 'Outros';
    }

    // Ano do cabeçalho: "Setembro 2025", "Período ... de 2025 até ... de 2026".
    function anoDoCabecalho(linha) {
      var s = semAcento(linha);
      var m = /\b(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*\s*\/?\s*(\d{4})\b/.exec(s);
      if (m) return { ano: +m[2], mes: MESES[m[1]] };
      m = /\b(\d{2})\/(\d{2})\/(\d{4})\b/.exec(linha);
      if (m) return { ano: +m[3], mes: +m[2] };
      return null;
    }

    // Numa fatura o valor positivo é gasto. Fora dela, o sinal manda.
    function ajeitarFatura(itens) {
      itens.forEach(function (it) {
        // Numa fatura não existe coluna "Tipo": o que eu tirei era descrição.
        if (it.descricaoCheia) it.descricao = it.descricaoCheia.slice(0, 80);
        if (it.credito) { it.tipo = 'entrada'; it.categoria = categoriaDe(it.descricao, 'entrada'); }
        else if (!it.negativoNoTexto) { it.tipo = 'saida'; it.categoria = categoriaDe(it.descricao, 'saida'); }
      });
      return itens;
    }

    function lerLinhas(linhas, nomeArquivo) {
      var itens = [];
      var ano = null, mesRef = null;
      var hoje = new Date();
      var dataDoDia = '';

      // Primeira passada: separa as linhas que são lançamento e os números de
      // cada uma. Só depois dá para saber se a última coluna é saldo.
      var candidatos = [];
      linhas.forEach(function (linha) {
        var cab = anoDoCabecalho(linha);
        if (cab && cab.ano) { ano = cab.ano; mesRef = cab.mes; }

        // Cabeçalho de dia: guarda a data e segue. Ele não é lançamento.
        var doDia = dataDeCabecalhoDeDia(linha);
        if (doDia) { dataDoDia = doDia; return; }

        if (devePular(linha)) return;

        var d = acharData(linha, ano || hoje.getFullYear());
        // Sem data na linha, vale a do cabeçalho do dia.
        if (!d || !d.data) {
          if (!dataDoDia) return;
          d = { data: dataDoDia, fim: 0, ini: 0 };
        }

        var valores = acharValores(linha.slice(d.fim));
        if (!valores.length) return;
        candidatos.push({ linha: linha, d: d, valores: valores });
      });

      var comSaldo = pareceColunaDeSaldo(candidatos) ||
                     temColunaDeSaldo(linhas.join('\n'));
      var saldoFinal = null;

      candidatos.forEach(function (c) {
        var linha = c.linha, d = c.d, valores = c.valores;

        // O valor do lançamento é o último número da linha. Quando existe a
        // coluna de saldo, o último é o saldo e o valor é o de antes.
        var v = valores[valores.length - 1];
        if (comSaldo && valores.length >= 2) {
          saldoFinal = comSinal(valores[valores.length - 1]);
          v = valores[valores.length - 2];
        }
        if (!v.valor) return;

        var resto = linha.slice(d.fim);
        var descricao = resto.slice(0, v.ini).replace(/^\s*\d{1,2}\/\d{1,2}(\/\d{2,4})?\s*/, '').trim();
        var cauda = resto.slice(v.fim).trim();

        // Itaú e afins marcam D de débito e C de crédito depois do valor.
        var marca = /^([DC])\b/.exec(cauda.toUpperCase());
        var textoCheio = descricao;
        var coluna = tirarColunaTipo(descricao);
        if (coluna) descricao = coluna.descricao;

        var tipo;
        if (marca) tipo = marca[1] === 'D' ? 'saida' : 'entrada';
        else if (v.negativo) tipo = 'saida';
        else if (coluna) tipo = coluna.tipo;
        else {
          var s = semAcento(descricao);
          if (ENTRADA.test(s) && !SAIDA.test(s)) tipo = 'entrada';
          else if (SAIDA.test(s)) tipo = 'saida';
          else tipo = 'entrada';
        }

        descricao = arrumarDescricao(descricao);
        if (!descricao) descricao = tipo === 'entrada' ? 'Entrada' : 'Saída';

        // A categoria sai do texto inteiro: a coluna de tipo também dá pista.
        itens.push({
          data: d.data, descricao: descricao.slice(0, 80), valor: v.valor, tipo: tipo,
          categoria: categoriaDe(textoCheio, tipo),
          descricaoCheia: textoCheio,
          negativoNoTexto: v.negativo || (marca && marca[1] === 'D'),
          credito: CREDITO_NA_FATURA.test(semAcento(textoCheio))
        });
      });

      // Sem ano na linha o C6 vira o ano no meio do extrato: 12/12 depois 05/01.
      arrumarVirada(itens);

      var cheio = linhas.join('\n');
      var fatura = pareceFatura(cheio, nomeArquivo);
      if (fatura) ajeitarFatura(itens);
      // O saldo que o próprio banco imprime na última linha é a melhor prova
      // de que a leitura saiu certa: dá para comparar com a conta do app.
      return { itens: itens, fatura: fatura, banco: acharBanco(cheio, nomeArquivo),
               saldoFinal: fatura ? null : saldoFinal };
    }

    function arrumarVirada(itens) {
      for (var i = 1; i < itens.length; i++) {
        var a = itens[i - 1].data, b = itens[i].data;
        if (a && b && b < a) {
          var dif = (new Date(a) - new Date(b)) / 86400000;
          if (dif > 300) {
            var p = b.split('-');
            itens[i].data = (+p[0] + 1) + '-' + p[1] + '-' + p[2];
          }
        }
      }
      return itens;
    }

    // ---------- OFX ----------

    function lerOfx(texto, nomeArquivo) {
      var itens = [];
      var blocos = texto.split(/<STMTTRN>/i).slice(1);
      blocos.forEach(function (b) {
        function campo(nome) {
          var m = new RegExp('<' + nome + '>([^<\\r\\n]*)', 'i').exec(b);
          return m ? m[1].trim() : '';
        }
        var dt = campo('DTPOSTED').replace(/[^\d]/g, '');
        if (dt.length < 8) return;
        var data = dt.slice(0, 4) + '-' + dt.slice(4, 6) + '-' + dt.slice(6, 8);
        var bruto = campo('TRNAMT').replace(/\s/g, '').replace(',', '.');
        var n = parseFloat(bruto);
        if (!isFinite(n) || !n) return;
        var desc = campo('MEMO') || campo('NAME') || 'Lançamento';
        var tipo = n < 0 ? 'saida' : 'entrada';
        itens.push({ data: data, descricao: desc.slice(0, 80), valor: Math.round(Math.abs(n) * 100),
                     tipo: tipo, categoria: categoriaDe(desc, tipo),
                     negativoNoTexto: n < 0, credito: CREDITO_NA_FATURA.test(semAcento(desc)) });
      });
      var fatura = pareceFatura(texto, nomeArquivo);
      if (fatura) ajeitarFatura(itens);
      return { itens: itens, fatura: fatura, banco: acharBanco(texto, nomeArquivo) };
    }

    // ---------- CSV ----------

    // Divide respeitando aspas: sem isso um valor "1.234,56" vira duas colunas.
    function partirLinha(linha, sep) {
      var fora = [], atual = '', dentro = false;
      for (var i = 0; i < linha.length; i++) {
        var c = linha[i];
        if (c === '"') {
          if (dentro && linha[i + 1] === '"') { atual += '"'; i++; }
          else dentro = !dentro;
          continue;
        }
        if (c === sep && !dentro) { fora.push(atual.trim()); atual = ''; continue; }
        atual += c;
      }
      fora.push(atual.trim());
      return fora;
    }

    // Uma tabela (CSV ou planilha) já vem em colunas: dá para saber qual é a
    // data, qual é a descrição e qual é o valor, em vez de adivinhar na frase.
    function lerTabela(linhas, nomeArquivo) {
      var itens = [];
      var cheio = linhas.map(function (l) { return l.join(' '); }).join('\n');
      var fatura = pareceFatura(cheio, nomeArquivo);

      linhas.forEach(function (partes) {
        if (partes.length < 2) return;
        var junta = partes.join('  ');
        if (devePular(junta)) return;

        // A data: a primeira célula que é só uma data.
        var iData = -1, data = '';
        for (var i = 0; i < partes.length; i++) {
          var p = String(partes[i]).trim();
          if (!p) continue;
          var d = acharData(p, new Date().getFullYear());
          if (d && d.data && p.length <= 24) { iData = i; data = d.data; break; }
        }
        if (!data) return;

        // O valor: a última célula que é só dinheiro.
        var iValor = -1, valor = null;
        for (var k = partes.length - 1; k >= 0; k--) {
          if (k === iData) continue;
          var c = String(partes[k]).trim();
          if (!c || !/\d/.test(c)) continue;
          if (!/^[-+]?\s*R?\$?\s*[-+]?\s*[\d.]+,?\d*\s*[DC]?$/.test(c) &&
              !/^[-+]?\s*R?\$?\s*[-+]?\s*\d+(\.\d+)?\s*[DC]?$/.test(c)) continue;
          var achados = acharValores(c);
          if (!achados.length) {
            // Valor sem centavos, tipo "1250" ou "-89.9".
            var n = parseFloat(c.replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
            if (!isFinite(n) || !n) continue;
            valor = { valor: Math.round(Math.abs(n) * 100), negativo: n < 0, marca: /\s([DC])$/i.exec(c) };
          } else {
            var a = achados[achados.length - 1];
            valor = { valor: a.valor, negativo: a.negativo, marca: /\s([DC])$/i.exec(c) };
          }
          iValor = k;
          break;
        }
        if (!valor || !valor.valor) return;

        // A descrição: a maior célula de texto que sobrou.
        var desc = '';
        partes.forEach(function (p, i) {
          if (i === iData || i === iValor) return;
          var t = String(p).trim();
          if (!t || /^[\d.,\-+R$\s]*$/.test(t)) return;
          if (t.length > desc.length) desc = t;
        });

        var cheioDaLinha = desc || junta;
        var negativo = valor.negativo || (valor.marca && valor.marca[1].toUpperCase() === 'D');
        var credito = CREDITO_NA_FATURA.test(semAcento(cheioDaLinha));

        var tipo;
        if (fatura) tipo = credito ? 'entrada' : (negativo ? 'entrada' : 'saida');
        else if (negativo) tipo = 'saida';
        else if (valor.marca) tipo = valor.marca[1].toUpperCase() === 'D' ? 'saida' : 'entrada';
        else if (ENTRADA.test(semAcento(cheioDaLinha))) tipo = 'entrada';
        else if (SAIDA.test(semAcento(cheioDaLinha))) tipo = 'saida';
        else tipo = 'entrada';

        var textoCheio = desc;
        var coluna = fatura ? null : tirarColunaTipo(desc);
        if (coluna) { desc = coluna.descricao; if (!negativo && !valor.marca) tipo = coluna.tipo; }
        desc = arrumarDescricao(desc);
        if (!desc) desc = tipo === 'entrada' ? 'Entrada' : 'Saída';

        itens.push({ data: data, descricao: desc.slice(0, 80), valor: valor.valor, tipo: tipo,
                     categoria: categoriaDe(textoCheio || desc, tipo),
                     negativoNoTexto: negativo, credito: credito });
      });

      arrumarVirada(itens);
      return { itens: itens, fatura: fatura, banco: acharBanco(cheio, nomeArquivo) };
    }

    // Divide respeitando aspas: sem isso um valor "1.234,56" vira duas colunas.
    function partirLinha(linha, sep) {
      var fora = [], atual = '', dentro = false;
      for (var i = 0; i < linha.length; i++) {
        var c = linha[i];
        if (c === '"') {
          if (dentro && linha[i + 1] === '"') { atual += '"'; i++; }
          else dentro = !dentro;
          continue;
        }
        if (c === sep && !dentro) { fora.push(atual.trim()); atual = ''; continue; }
        atual += c;
      }
      fora.push(atual.trim());
      return fora;
    }

    function lerCsv(texto, nomeArquivo) {
      var brutas = texto.replace(/^\uFEFF/, '').split(/\r?\n/).filter(function (l) { return l.trim(); });
      if (!brutas.length) return { itens: [], fatura: false, banco: null };

      var amostra = brutas.slice(0, 6);
      var escolha = [';', '\t', ','].map(function (sep) {
        var n = 0;
        amostra.forEach(function (l) { n += partirLinha(l, sep).length - 1; });
        return { sep: sep, n: n };
      }).sort(function (a, b) { return b.n - a.n; })[0];
      var sep = escolha.n ? escolha.sep : ';';

      return lerTabela(brutas.map(function (l) { return partirLinha(l, sep); }), nomeArquivo);
    }

    return { lerPdf: extrair, lerLinhas: lerLinhas, lerOfx: lerOfx, lerCsv: lerCsv,
             lerTabela: lerTabela, lerXlsx: lerXlsx, categoriaDe: categoriaDe,
             acharBanco: acharBanco, bancoPorChave: bancoPorChave, listaDeBancos: listaDeBancos,
             pareceFatura: pareceFatura, textoDeBytes: textoDeBytes };
  })();
