/* ==========================================================================
   Dados de demonstração
   Enquanto o backend (banco de dados + n8n + APIs) não está pronto, a
   interface usa estes dados de exemplo. Os atendimentos são criados com as
   funções oficiais de js/atendimentos.js.
   ========================================================================== */

import { criarAtendimento, alterarStatusAtendimento, STATUS } from "./atendimentos.js";

/* Monta um atendimento completo (status + dados de exibição) */
function atendimentoDemo({ id, cliente, status, telefone, origem, mensagens, interesse }) {
  let atendimento = criarAtendimento(id, cliente);
  if (status !== STATUS.EM_ATENDIMENTO) {
    atendimento = alterarStatusAtendimento(atendimento, status);
  }
  return { ...atendimento, telefone, origem, interesse, mensagens };
}

/* Autor das mensagens: "cliente" | "ia" | "humano" | "sistema" */
export const atendimentosDemo = [
  atendimentoDemo({
    id: "001",
    cliente: "Maria Oliveira",
    status: STATUS.AGUARDANDO_HUMANO,
    telefone: "5583999990001",
    origem: "Instagram",
    interesse: "Encomenda para festa",
    mensagens: [
      { autor: "cliente", texto: "Olá, vim do Instagram!", hora: "09:12" },
      { autor: "ia", texto: "Olá, Maria! Sou o assistente virtual da loja. Como posso ajudar?", hora: "09:12" },
      { autor: "cliente", texto: "Vocês fazem bolo para 50 pessoas? É para sábado.", hora: "09:13" },
      { autor: "ia", texto: "Fazemos sim! O bolo de chocolate serve até 20 pessoas por R$ 89,90. Para 50 pessoas, vou chamar um atendente para montar um orçamento personalizado.", hora: "09:13" },
      { autor: "sistema", texto: "A IA transferiu a conversa para um atendente humano", hora: "09:13" }
    ]
  }),
  atendimentoDemo({
    id: "002",
    cliente: "João Santos",
    status: STATUS.EM_ATENDIMENTO,
    telefone: "5583988880002",
    origem: "WhatsApp",
    interesse: "Preços",
    mensagens: [
      { autor: "cliente", texto: "Boa tarde, qual o valor da torta de limão?", hora: "10:02" },
      { autor: "ia", texto: "Boa tarde, João! A torta de limão custa R$ 64,00 e serve 12 fatias. Deseja fazer um pedido?", hora: "10:02" },
      { autor: "cliente", texto: "Tem para entrega hoje?", hora: "10:04" }
    ]
  }),
  atendimentoDemo({
    id: "003",
    cliente: "Ana Costa",
    status: STATUS.ASSUMIDO,
    telefone: "5583977770003",
    origem: "Instagram",
    interesse: "Reclamação de entrega",
    mensagens: [
      { autor: "cliente", texto: "Meu pedido de ontem chegou atrasado.", hora: "08:40" },
      { autor: "ia", texto: "Sinto muito pelo ocorrido, Ana. Vou chamar um atendente para resolver isso com você.", hora: "08:40" },
      { autor: "sistema", texto: "Atendimento assumido por um atendente", hora: "08:45" },
      { autor: "humano", texto: "Olá, Ana! Peço desculpas pelo atraso. Vou verificar o que aconteceu com a entrega.", hora: "08:46" }
    ]
  }),
  atendimentoDemo({
    id: "004",
    cliente: "Carlos Pereira",
    status: STATUS.RESOLVIDO,
    telefone: "5583966660004",
    origem: "WhatsApp",
    interesse: "Horário de funcionamento",
    mensagens: [
      { autor: "cliente", texto: "Que horas vocês abrem no sábado?", hora: "Ontem" },
      { autor: "ia", texto: "Olá, Carlos! Aos sábados funcionamos das 8h às 18h.", hora: "Ontem" },
      { autor: "cliente", texto: "Perfeito, obrigado!", hora: "Ontem" },
      { autor: "sistema", texto: "Atendimento marcado como resolvido", hora: "Ontem" }
    ]
  }),
  atendimentoDemo({
    id: "005",
    cliente: "Beatriz Lima",
    status: STATUS.EM_ATENDIMENTO,
    telefone: "5583955550005",
    origem: "Instagram",
    interesse: "Catálogo",
    mensagens: [
      { autor: "cliente", texto: "Vi o post dos brigadeiros gourmet. Quais sabores vocês têm?", hora: "11:20" },
      { autor: "ia", texto: "Oi, Beatriz! Temos o cento de brigadeiro gourmet por R$ 120,00, com sabores tradicional, ninho e pistache. Posso ajudar com mais alguma coisa?", hora: "11:20" }
    ]
  }),
  atendimentoDemo({
    id: "006",
    cliente: "Rafael Souza",
    status: STATUS.RESOLVIDO,
    telefone: "5583944440006",
    origem: "WhatsApp",
    interesse: "Pedido",
    mensagens: [
      { autor: "cliente", texto: "Quero encomendar uma torta de limão.", hora: "Ontem" },
      { autor: "ia", texto: "Ótima escolha! A torta de limão custa R$ 64,00. Para qual dia seria?", hora: "Ontem" },
      { autor: "cliente", texto: "Para sexta, às 15h.", hora: "Ontem" },
      { autor: "humano", texto: "Pedido confirmado para sexta às 15h. Obrigado, Rafael!", hora: "Ontem" },
      { autor: "sistema", texto: "Atendimento marcado como resolvido", hora: "Ontem" }
    ]
  })
];

/* Métricas do Dashboard por período (seletor "Últimos 7 dias")
   clientes = finalizadosIA + emTratamento + naoConcluidos + intervencaoHumana */
export const periodosDemo = {
  hoje: {
    rotulo: "Hoje",
    finalizadosIA: 31, emTratamento: 9, naoConcluidos: 4, intervencaoHumana: 6,
    tendencia: { clientes: 8 },
    origem: { instagramPosts: 52, instagramDirect: 20, outros: 16, linkDireto: 12 },
    vendas: 1840, tendenciaVendas: 12,
    serieVendas: [120, 90, 210, 160, 240, 190, 300, 260, 270]
  },
  semana: {
    rotulo: "Últimos 7 dias",
    finalizadosIA: 212, emTratamento: 48, naoConcluidos: 32, intervencaoHumana: 36,
    tendencia: { clientes: 12 },
    origem: { instagramPosts: 58, instagramDirect: 17, outros: 15, linkDireto: 10 },
    vendas: 12480, tendenciaVendas: 27,
    serieVendas: [900, 1300, 1150, 1700, 1500, 1950, 1800, 2300, 2600]
  },
  mes: {
    rotulo: "Últimos 30 dias",
    finalizadosIA: 874, emTratamento: 121, naoConcluidos: 140, intervencaoHumana: 165,
    tendencia: { clientes: 18 },
    origem: { instagramPosts: 55, instagramDirect: 19, outros: 14, linkDireto: 12 },
    vendas: 48920, tendenciaVendas: 21,
    serieVendas: [8200, 9100, 8700, 10400, 9800, 11900, 11200, 12800, 14100]
  }
};

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
