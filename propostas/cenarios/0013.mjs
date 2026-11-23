// Conta com R$ 1.880,00 hoje e um aluguel de R$ 450,00 agendado para daqui
// a 20 dias. O banco mostra R$ 1.880,00. Abre "Ajustar saldo".
export default async function (page) {
  await page.evaluate(() => new Promise((res) => {
    const h = new Date();
    const d = (n) => {
      const x = new Date(h.getFullYear(), h.getMonth(), h.getDate() + n);
      return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') +
             '-' + String(x.getDate()).padStart(2, '0');
    };
    const dados = {
      contas: [{ id: 'cc-aj', nome: 'Banco Inter', tipo: 'Conta corrente', saldoInicial: 200000 }],
      lancamentos: [
        { id: 'aj1', tipo: 'saida', valor: 12000, data: d(-6), contaId: 'cc-aj',
          categoria: 'Transporte', descricao: 'Posto Ipiranga' },
        { id: 'aj2', tipo: 'saida', valor: 45000, data: d(20), contaId: 'cc-aj',
          categoria: 'Moradia', descricao: 'Aluguel agendado' }
      ]
    };
    const f = new File([JSON.stringify({ app: 'finanz', dados })], 'b.json', { type: 'application/json' });
    const inp = document.getElementById('arquivoRestaurar');
    const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
    inp.dispatchEvent(new Event('change'));
    setTimeout(() => res(true), 900);
  }));
  await page.click('#dialogoAcoes button:has-text("Restaurar")');
  await page.waitForTimeout(3000);
  await page.click('#navegacao button:has-text("Início")');
  await page.waitForTimeout(1500);
  await page.click('#telaInicio .linha-alvo:has-text("Banco Inter")');
  await page.waitForTimeout(1400);
  await page.click('#folha button:has-text("Ajustar saldo")');
  await page.waitForTimeout(1200);
  // Digita o saldo que o banco mostra: R$ 1.880,00.
  await page.locator('#folha .campo-saldo-certo').evaluate((n) => { n.value = '188000'; n.dispatchEvent(new Event('input')); });
  await page.waitForTimeout(400);
  await page.locator('#folha .diferenca-ajuste').evaluate((n) => n.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(500);
  const r = await page.locator('#folha .forma').evaluate((n) => { const b = n.getBoundingClientRect(); return { top: b.top }; });
  const y = Math.max(0, Math.round(r.top));
  return { x: 0, y, width: 390, height: Math.min(520, 844 - y) };
}
