// Configuração do servidor.
//
// Com estes campos preenchidos, o Finanz cria a conta no Supabase e
// sincroniza os dados. Em branco, ele funciona só dentro do aparelho.
//
// Estas duas chaves são públicas por natureza: ficam dentro do app e
// qualquer pessoa consegue lê-las no navegador. Quem protege os dados é
// o Row Level Security configurado no banco, não o sigilo delas.
// A chave secreta (service_role / sb_secret_) NUNCA entra aqui.
//
// Passo a passo em supabase/CONFIGURACAO.md.

window.FINANZ_CONFIG = {
  // A conta da manutenção. Só ela enxerga "Versões guardadas" em Mais, e
  // só para ela a página de versões se abre.
  //
  // Isto é tranca de porta, não cofre: as versões ficam num site público e
  // quem souber o endereço de uma delas abre direto, sem passar por aqui.
  // Serve para o app não oferecer manutenção a quem não é da manutenção.
  dono: 'vitortorresdarosa@gmail.com',
  supabaseUrl: 'https://udebkowqklrzhadndabs.supabase.co',
  supabaseAnonKey: 'sb_publishable_8igq8JudFCLhvkfMKJAJFQ_wTEftWWs'
};
