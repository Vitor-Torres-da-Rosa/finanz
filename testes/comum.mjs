// O que todo teste precisa saber: onde acham o Playwright, onde ficam os
// arquivos de exemplo e onde jogar as imagens de tela.
//
// Nada aqui usa caminho fixo de máquina: tudo sai da posição deste arquivo,
// então a pasta de testes funciona em qualquer container.
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const raiz = path.dirname(fileURLToPath(import.meta.url));
export const amostras = path.join(raiz, 'amostras');
export const dir = path.join(raiz, 'saidas');
export const app = path.join(raiz, 'appteste');
export const ENDERECO = 'http://127.0.0.1:8833/index.html';

fs.mkdirSync(dir, { recursive: true });

// O Playwright vem instalado na imagem, mas nem sempre no mesmo lugar.
async function acharChromium() {
  const tentativas = ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs'];
  for (const caminho of tentativas) {
    try { return (await import(caminho)).chromium; } catch (e) { /* tenta o próximo */ }
  }
  throw new Error('não achei o Playwright. Rode testes/preparar.sh.');
}

export const chromium = await acharChromium();

// O "+" abre um menu (Transferência, Receita, Despesa, Despesa cartão)
// fora do Empreendedor. No Empreendedor ele continua abrindo o cliente.
// `opcao` é o data-opcao do item: 'saida', 'entrada', 'transferencia', 'cartao'.
export async function tocarFab(page, opcao = 'saida') {
  // 08/11/2026: no Empreendedor o "+" redondo saiu; o cliente novo é o
  // "+ Novo" da aba Clientes.
  if (await page.$eval('#fab', b => b.classList.contains('fab-oculto')).catch(() => false)) {
    await page.click('#telaInicio .cartao-acao:has-text("+ Novo")');
    await page.locator('#folha.aberta').waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
    return;
  }
  await page.click('#fab');
  const item = page.locator('#menuNovo.aberto button[data-opcao="' + opcao + '"]');
  try { await item.waitFor({ state: 'visible', timeout: 700 }); } catch (e) { return; }
  await item.click();
  await page.locator('#folha.aberta').waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
}

// O Empreendedor virou três módulos. Os clientes (o Empreendedor de antes)
// moram em Serviços e Vendas › Clientes. Funciona de onde estiver: Visão
// geral, entrada do Empreendedor ou dentro de outro módulo.
export async function irParaClientes(page) {
  const naTela = async (sel) => (await page.locator(sel).count()) > 0;
  if (await naTela('#telaInicio .modulo-cabecalho') &&
      !(await naTela('#telaInicio .abas-modulo button:has-text("Clientes")'))) {
    await page.click('#telaInicio .modulo-voltar'); await page.waitForTimeout(700);
  }
  if (!(await naTela('#telaInicio .modulo-cabecalho'))) {
    const seg = page.locator('#telaInicio .segmentos button:has-text("Empreendedor")');
    if (await seg.count()) { await seg.first().click(); await page.waitForTimeout(800); }
    await page.click('#telaInicio [data-modulo="servicos"]'); await page.waitForTimeout(800);
  }
  await page.click('#telaInicio .abas-modulo button:has-text("Clientes")'); await page.waitForTimeout(700);
}

export async function irParaVisaoGeral(page) {
  for (let i = 0; i < 3; i++) {
    if (!(await page.locator('#telaInicio .modulo-cabecalho').count())) break;
    await page.click('#telaInicio .modulo-voltar'); await page.waitForTimeout(700);
  }
  await page.click('#telaInicio .segmentos button:has-text("Visão geral")'); await page.waitForTimeout(800);
}

// A aba Pagos da ficha do cliente saiu na 5.36.0: o histórico de
// pagamentos mora dentro de Parcelas, fechado por padrão. Isto abre a aba
// e o histórico, e o primeiro pagamento fica em '#folha .linha-pagamento'.
export async function abrirHistorico(page) {
  await page.click('#folha .aba-cliente button:has-text("Parcelas")'); await page.waitForTimeout(700);
  const t = page.locator('#folha .historico-toggle[aria-expanded="false"]');
  if (await t.count()) { await t.click(); await page.waitForTimeout(600); }
}
