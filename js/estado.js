/* ==========================================================================
   Estado compartilhado dos atendimentos
   O Dashboard e a tela de WhatsApp leem a mesma lista; qualquer mudança de
   status notifica as telas inscritas para que se atualizem.
   ========================================================================== */

import { STATUS, criarAtendimento, alterarStatusAtendimento } from "./atendimentos.js";

// A lista guarda os atendimentos e as mensagens confirmados pelo Supabase.
let atendimentos = [];
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
  return substituir({
    ...alterarStatusAtendimento(buscarAtendimento(id), statusDaInterface(dados.status)),
    statusBanco: dados.status
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
  for (const registro of registros) {
    const data = new Date(registro.created_at);
    porId.set(registro.id, {
      id: registro.id,
      autor: registro.autor,
      texto: registro.texto,
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
  const dados = await acessarAtendimentos(`/${id}/mensagens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mensagem)
  });
  atualizarMensagens(id, [dados.mensagem]);
}

// Adapta o registro do banco aos campos que o WhatsApp usa.
function prepararAtendimento(registro) {
  const atendimento = criarAtendimento(String(registro.id), registro.clientes.nome);
  return {
    ...alterarStatusAtendimento(atendimento, statusDaInterface(registro.status)),
    statusBanco: registro.status,
    telefone: registro.clientes.telefone || "",
    origem: "—",
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
    throw new Error(dados?.erro || "Não foi possível acessar os atendimentos.");
  }
  return dados;
}

// Carrega a lista salva e avisa o WhatsApp e o Dashboard.
export async function carregarAtendimentos() {
  const dados = await acessarAtendimentos();
  const salvos = dados.atendimentos.map((registro) =>
    buscarAtendimento(String(registro.id)) ?? prepararAtendimento(registro)
  );
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
  atendimentos = [atendimento, ...atendimentos];
  notificar();
  return atendimento;
}
