// Cliente com parcela em dia não pode aparecer como atrasado.
//
// "proximoPagamento" é herança de uma versão antiga: o app de hoje cria
// todo cliente com ele vazio e não tem campo na tela para editá-lo. Ele
// só reaparece por restauração de backup ou sincronização — que é
// exatamente como este teste o injeta.
//
// clienteAtrasado() olhava esse campo SEMPRE, mesmo com as parcelas em
// dia. Uma data antiga, invisível e não-editável, marcava o cliente como
// atrasado para sempre. Foi o caso da Daniela Torres em 19/10/2026:
// R$ 960,00, parcela em dia, etiqueta vermelha de atrasado.
//
// Agora quem manda é a parcela, igual proximoVencimento() já fazia. A
// data solta virou reserva, só para cliente sem parcela nenhuma aberta —
// e aí a tela diz de onde veio o aviso e deixa tirar a data.
import fs from 'node:fs';
import path from 'node:path';
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));

let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();
const dia = (desloc) => {
  const d = new Date(); d.setDate(d.getDate() + desloc);
  return d.toISOString().slice(0, 10);
};

// Backup com os dois casos que importam:
//  - Daniela: data velha no cadastro, mas parcela vencendo daqui a 30 dias
//  - Hermes:  data velha no cadastro e nenhuma parcela
const backup = {
  app: 'Finanz', versao: 3, em: new Date().toISOString(),
  dados: {
    versao: 3,
    perfil: { nome: 'Vitor' },
    contas: [{ id: 'c1', nome: 'Carteira', tipo: 'Dinheiro físico', saldoInicial: 0, cor: '#E9B44C' }],
    lancamentos: [],
    clientes: [
      { id: 'cl1', nome: 'Daniela Torres', telefone: '51984443333', whatsapp: true,
        proximoPagamento: dia(-90) },
      { id: 'cl2', nome: 'Hermes Klagenberg', telefone: '51920000000', whatsapp: true,
        proximoPagamento: dia(-60) }
    ],
    servicos: [
      { id: 's1', clienteId: 'cl1', nome: 'Serviço da Daniela', tipo: 'Serviço', valor: 96000, data: dia(-100) },
      { id: 's2', clienteId: 'cl2', nome: 'Serviço do Hermes', tipo: 'Serviço', valor: 200000, data: dia(-70) }
    ],
    parcelas: [
      { id: 'p1', clienteId: 'cl1', servicoId: 's1', numero: 1, total: 1,
        valor: 96000, vencimento: dia(30) }
    ],
    pagamentos: [], ativos: [], metas: []
  }
};
const caminho = path.join(dir, 't101-backup-' + process.pid + '.json');
fs.writeFileSync(caminho, JSON.stringify(backup, null, 2));

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor');
await c.nth(1).fill('t101-' + Date.now() + '-' + process.pid + '@exemplo.com');
await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// --- restaurar, que é como a herança chega na vida real ---
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(900);
page.on('filechooser', async fc => { await fc.setFiles(caminho); });
await page.click('#telaMais .linha:has-text("Restaurar backup")'); await page.waitForTimeout(1800);
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3000);

await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(1000);
await page.click('#telaInicio button:has-text("Empreendedor")'); await page.waitForTimeout(1600);
const tela = limpo(await page.textContent('#telaInicio'));
console.log('clientes:', tela.slice(tela.indexOf('Clientes'), tela.indexOf('Clientes') + 220));

// Leio a LINHA do cliente na lista, não o texto solto da página: o nome
// também aparece no cartão de recado lá em cima ("Abrir Fulano ›"), e
// fatiar a partir da primeira ocorrência pegava aquele, não este. A
// linha atrasada carrega a classe 'atrasada', que é o sinal de verdade.
const linhaDoCliente = async (nome) => {
  return page.evaluate((n) => {
    const linhas = Array.from(document.querySelectorAll('#telaInicio .linha-dupla'));
    const l = linhas.find((x) => (x.textContent || '').indexOf(n) >= 0);
    if (!l) return null;
    return { classe: l.className, texto: (l.textContent || '').replace(/\s+/g, ' ').trim() };
  }, nome);
};

conferir('1. a Daniela aparece', /Daniela Torres/.test(tela));
const dani = await linhaDoCliente('Daniela Torres');
const herm = await linhaDoCliente('Hermes Klagenberg');
console.log('linha Daniela:', JSON.stringify(dani));
console.log('linha Hermes :', JSON.stringify(herm));
conferir('2. e NÃO está atrasada: a parcela dela vence daqui a 30 dias',
  !!dani && !/atrasada/.test(dani.classe) && !/atrasado/.test(dani.texto),
  dani ? dani.texto.slice(0, 80) : 'linha não achada');
conferir('3. o Hermes, esse sim, segue atrasado: não tem parcela nenhuma',
  !!herm && /atrasada/.test(herm.classe) && /atrasado/.test(herm.texto),
  herm ? herm.texto.slice(0, 80) : 'linha não achada');
await page.screenshot({ path: dir+'/l01-daniela-em-dia.png', fullPage: true });

// --- e no Hermes a tela diz de onde veio, e deixa tirar ---
await page.click('#telaInicio .linha:has-text("Hermes Klagenberg")'); await page.waitForTimeout(1600);
const folha = limpo(await page.textContent('#folha'));
console.log('folha:', folha.slice(0, 230));
conferir('4. a cobrança explica que não há parcela vencida',
  /Não há parcela vencida/.test(folha), folha.slice(0, 110));
conferir('5. e diz que a data vem de versão antiga do app',
  /versão antiga do app/.test(folha));
conferir('6. e oferece tirar a data do cadastro',
  /Tirar essa data do cadastro/.test(folha));
await page.screenshot({ path: dir+'/l02-de-onde-veio.png', fullPage: true });

await page.click('#folha button:has-text("Tirar essa data do cadastro")'); await page.waitForTimeout(2500);
await page.click('#telaInicio button:has-text("Empreendedor")').catch(() => {});
await page.waitForTimeout(1400);
const hermDepois = await linhaDoCliente('Hermes Klagenberg');
conferir('7. tirada a data, o Hermes sai do vermelho',
  !!hermDepois && !/atrasada/.test(hermDepois.classe) && !/atrasado/.test(hermDepois.texto),
  hermDepois ? hermDepois.texto.slice(0, 80) : 'linha não achada');

fs.unlinkSync(caminho);
await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: parcela em dia manda mais que data herdada');
