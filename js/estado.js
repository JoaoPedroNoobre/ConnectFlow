/* ==========================================================================
   Estado compartilhado dos atendimentos
   O Dashboard e a tela de WhatsApp leem a mesma lista; qualquer mudança de
   status notifica as telas inscritas para que se atualizem.
   ========================================================================== */

import { STATUS, criarAtendimento, alterarStatusAtendimento } from "./atendimentos.js";

// A lista guarda os atendimentos e as mensagens confirmados pelo Supabase.
let atendimentos = [];
let versaoLista = 0;
const ouvintes = new Set();

function notificar() {
  ouvintes.forEach((fn) => fn(atendimentos));
}

export function inscrever(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

export const listarAtendimentos = () => atendimentos;

export const buscarAtendimento = (id) => atendimentos.find((a) => a.id === id);

function substituir(atualizado) {
  atendimentos = atendimentos.map((a) => (a.id === atualizado.id ? atualizado : a));
  notificar();
  return atualizado;
}

// Salva a mudança no banco antes de atualizar os filtros e a conversa.
export async function mudarStatus(id, novoStatus) {
  const atual = buscarAtendimento(id);
  const dados = await acessarAtendimentos(`/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: novoStatus, anterior: atual.statusBanco })
  });
  const recente = buscarAtendimento(id);
  // Um evento pode chegar antes da resposta do botão com um status mais novo.
  if (dados.revisao_ia != null && recente.revisaoIA > dados.revisao_ia) return recente;
  return substituir({
    ...alterarStatusAtendimento(recente, statusDaInterface(dados.status)),
    statusBanco: dados.status,
    revisaoIA: dados.revisao_ia ?? atual.revisaoIA
  });
}

// Traduz o status do banco para os rótulos e filtros do WhatsApp.
function statusDaInterface(status) {
  if (status === "ia_atendendo") return STATUS.EM_ATENDIMENTO;
  return Object.values(STATUS).includes(status) ? status : STATUS.AGUARDANDO_HUMANO;
}

// Junta mensagens pelo ID e mantém a ordem, mesmo com uma leitura em andamento.
function atualizarMensagens(id, registros) {
  const atual = buscarAtendimento(id);
  const porId = new Map(atual.mensagens.map((mensagem) => [mensagem.id, mensagem]));
  const ordemEntrega = { enviando: 1, aceita: 2, enviada: 3, entregue: 4, lida: 5, falha: 4, incerta: 2 };
  for (const registro of registros) {
    const data = new Date(registro.created_at);
    const entregaAtual = porId.get(registro.id)?.entrega;
    const entrega = (ordemEntrega[entregaAtual] || 0) > (ordemEntrega[registro.entrega] || 0)
      ? entregaAtual : registro.entrega;
    porId.set(registro.id, {
      id: registro.id,
      autor: registro.autor,
      texto: registro.texto,
      entrega,
      data,
      hora: data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    });
  }
  const mensagens = [...porId.values()].sort((a, b) =>
    a.data - b.data || a.id.localeCompare(b.id, "pt-BR", { numeric: true })
  );
  return substituir({ ...atual, mensagens });
}

// Busca as mensagens do atendimento que foi aberto.
export async function carregarMensagens(id) {
  const dados = await acessarAtendimentos(`/${id}/mensagens`);
  atualizarMensagens(id, dados.mensagens);
}

// Só mostra a mensagem na conversa depois que o Supabase confirma a gravação.
export async function adicionarMensagem(id, mensagem) {
  try {
    const dados = await acessarAtendimentos(`/${id}/mensagens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mensagem)
    });
    atualizarMensagens(id, [dados.mensagem]);
  } catch (erro) {
    if (erro.mensagemRegistrada) atualizarMensagens(id, [erro.mensagemRegistrada]);
    throw erro;
  }
}

// Adapta o registro do banco aos campos que o WhatsApp usa.
function prepararAtendimento(registro) {
  const atendimento = criarAtendimento(String(registro.id), registro.clientes.nome);
  return {
    ...alterarStatusAtendimento(atendimento, statusDaInterface(registro.status)),
    statusBanco: registro.status,
    revisaoIA: registro.revisao_ia ?? 0,
    canal: registro.canal || "interno",
    telefone: registro.clientes.telefone || "",
    origem: registro.canal === "whatsapp" ? "WhatsApp" : "—",
    interesse: "—",
    mensagens: []
  };
}

// Usa a rota local e mostra o erro que o servidor devolveu.
async function acessarAtendimentos(caminho = "", opcoes) {
  const resposta = await fetch(`/api/atendimentos${caminho}`, opcoes).catch(() => {
    throw new Error("Não foi possível conectar ao servidor de atendimentos.");
  });
  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok || !dados) {
    const erro = new Error(dados?.erro || "Não foi possível acessar os atendimentos.");
    erro.mensagemRegistrada = dados?.mensagem;
    throw erro;
  }
  return dados;
}

// Carrega a lista salva e avisa o WhatsApp e o Dashboard.
export async function carregarAtendimentos() {
  const versao = ++versaoLista;
  const dados = await acessarAtendimentos();
  if (versao !== versaoLista) return;
  const salvos = dados.atendimentos.map((registro) => {
    const salvo = prepararAtendimento(registro);
    const atual = buscarAtendimento(salvo.id);
    if (!atual) return salvo;
    if (atual.revisaoIA > salvo.revisaoIA) return atual;
    return { ...salvo, mensagens: atual.mensagens, origem: atual.origem };
  });
  atendimentos = salvos;
  notificar();
}

// Só coloca o atendimento na lista depois da confirmação do Supabase.
export async function novoAtendimento(nome, telefone) {
  const dados = await acessarAtendimentos("", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome, telefone })
  });
  const atendimento = prepararAtendimento(dados.atendimento);
  atendimento.origem = "WhatsApp";
  versaoLista++;
  atendimentos = [atendimento, ...atendimentos.filter((item) => item.id !== atendimento.id)];
  notificar();
  return atendimento;
}
