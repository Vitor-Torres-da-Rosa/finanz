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
  supabaseUrl: 'https://jtxpradqfsbufdtartwn.supabase.co',
  supabaseAnonKey: 'sb_publishable_9rgcr2YLT3t4y1nwguqHXg_ly4uJdzP'
};
