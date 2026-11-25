/* Dados de demonstração do catálogo, do Instagram Studio e das integrações. */

/* Catálogo usado pelo Agente de IA */
export const catalogoDemo = [
  { id: 1, nome: "Bolo de chocolate", categoria: "Bolos", preco: 89.9 },
  { id: 2, nome: "Torta de limão", categoria: "Tortas", preco: 64 },
  { id: 3, nome: "Brigadeiro gourmet (cento)", categoria: "Doces", preco: 120 },
  { id: 4, nome: "Bolo de cenoura", categoria: "Bolos", preco: 54.9 }
];

/* Publicações do Instagram Studio */
export const postsDemo = [
  {
    id: 1, formato: "feed", status: "agendado", imagem: "", fundo: 1,
    legenda: "Novo produto na loja! 🍫 Bolo de chocolate belga, encomende pelo link da bio.",
    hashtags: "#confeitaria #bolodechocolate", data: proximaData(2), hora: "14:00"
  },
  {
    id: 2, formato: "feed", status: "agendado", imagem: "", fundo: 2,
    legenda: "Promoção da semana 🔥 Torta de limão com 15% de desconto.",
    hashtags: "#promocao #tortadelimao", data: proximaData(4), hora: "10:00"
  },
  {
    id: 3, formato: "story", status: "agendado", imagem: "", fundo: 3,
    legenda: "Quem somos? Conheça a nossa cozinha.",
    hashtags: "#bastidores", data: proximaData(6), hora: "18:00"
  },
  {
    id: 4, formato: "feed", status: "rascunho", imagem: "", fundo: 4,
    legenda: "Novidade chegando… 👀",
    hashtags: "", data: "", hora: ""
  },
  {
    id: 5, formato: "feed", status: "publicado", imagem: "", fundo: 2,
    legenda: "Torta de limão fresquinha saindo do forno! 🍋",
    hashtags: "#tortadelimao #docesartesanais", data: proximaData(-3), hora: "17:30"
  }
];

/* Integrações previstas no README: WhatsApp, Instagram, IA e n8n */
export const integracoesDemo = [
  { id: "whatsapp", nome: "WhatsApp Business", descricao: "Recebe e envia mensagens dos clientes na caixa de entrada.", icone: "i-whatsapp", cor: "#25d366", conectado: true },
  { id: "instagram", nome: "Instagram", descricao: "Publica e agenda conteúdos criados no Instagram Studio.", icone: "i-instagram", cor: "linear-gradient(45deg,#f9ce34,#ee2a7b 50%,#6228d7)", conectado: true },
  { id: "ia", nome: "Inteligência Artificial", descricao: "Modelo de linguagem que alimenta o Agente de IA.", icone: "i-sparkles", cor: "#7c3aed", conectado: true },
  { id: "n8n", nome: "n8n", descricao: "Fluxos de automação que conectam a plataforma às APIs.", icone: "i-zap", cor: "#ea4b71", conectado: false }
];

/* Data no formato AAAA-MM-DD a partir de hoje + n dias */
function proximaData(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}
