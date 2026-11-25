# Finanz — regras do Vitor para quem mexe no app

## O "i" informativo acompanha o app

Os cartões têm um "i" (`topoDeCartao(..., { chave, itens, versao })` e
`dicaComI`) que explica para que serve cada parte. Pedido do Vitor em
25/11/2026:

- Toda mudança **importante** no app (algo que muda o que a pessoa vê, o que
  um número significa ou como uma tela funciona) atualiza os textos do "i"
  daquela parte, na mesma versão.
- Mudou a explicação de verdade? Suba o `versao` do `info` (1 → 2 → 3…): o
  "i" volta a abrir sozinho uma vez, para a pessoa ver o que mudou.
- Ajuste pequeno (cor, alinhamento, texto que não muda o sentido) não mexe
  no "i" nem na versão dele.
- Parte nova que precisa de explicação ganha o seu "i".
