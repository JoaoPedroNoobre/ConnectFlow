/* ==========================================================================
   Estado compartilhado dos atendimentos
   O Dashboard e a tela de WhatsApp leem a mesma lista; qualquer mudança de
   status notifica as telas inscritas para que se atualizem.
   ========================================================================== */

import { STATUS, criarAtendimento, alterarStatusAtendimento } from "./atendimentos.js";

// A lista guarda os registros do Supabase e as mensagens da sessão.
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

/* Usa alterarStatusAtendimento (imutável) e registra a mudança na conversa */
export function mudarStatus(id, novoStatus, mensagemSistema, hora) {
  const atual = buscarAtendimento(id);
  const atualizado = alterarStatusAtendimento(atual, novoStatus);
  atualizado.mensagens = [...atual.mensagens, { autor: "sistema", texto: mensagemSistema, hora }];
  return substituir(atualizado);
}

export function adicionarMensagem(id, mensagem) {
  const atual = buscarAtendimento(id);
  return substituir({ ...atual, mensagens: [...atual.mensagens, mensagem] });
}

// Adapta o registro do banco aos campos que o WhatsApp usa.
function prepararAtendimento(registro) {
  const status = registro.status === "ia_atendendo" ? STATUS.EM_ATENDIMENTO : registro.status;
  // Um status desconhecido fica na fila de atendimento humano.
  const statusValido = Object.values(STATUS).includes(status) ? status : STATUS.AGUARDANDO_HUMANO;
  const atendimento = criarAtendimento(String(registro.id), registro.clientes.nome);
  return {
    ...alterarStatusAtendimento(atendimento, statusValido),
    telefone: registro.clientes.telefone || "",
    origem: "—",
    interesse: "—",
    mensagens: []
  };
}

// Usa a rota local e mostra o erro que o servidor devolveu.
async function acessarAtendimentos(opcoes) {
  const resposta = await fetch("/api/atendimentos", opcoes).catch(() => {
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
  const dados = await acessarAtendimentos({
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
