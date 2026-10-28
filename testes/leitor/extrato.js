(function (raiz) {
  'use strict';

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

  raiz.CaixaExtrato = { lerLinhas: lerLinhas, lerOfx: lerOfx, lerCsv: lerCsv, lerTabela: lerTabela,
                        categoriaDe: categoriaDe, acharBanco: acharBanco, bancoPorChave: bancoPorChave,
                        listaDeBancos: listaDeBancos, pareceFatura: pareceFatura };
})(typeof globalThis !== 'undefined' ? globalThis : this);
