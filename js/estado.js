/* ==========================================================================
   Estado compartilhado dos atendimentos
   O Dashboard e a tela de WhatsApp leem a mesma lista; qualquer mudança de
   status notifica as telas inscritas para que se atualizem.
   ========================================================================== */

import { criarAtendimento, alterarStatusAtendimento } from "./atendimentos.js";

// A lista começa vazia e recebe os atendimentos criados na tela.
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

/* Usa criarAtendimento para validar e criar um novo atendimento */
export function novoAtendimento(nomeCliente, telefone) {
  const proximoId = String(
    Math.max(0, ...atendimentos.map((a) => Number(a.id) || 0)) + 1
  ).padStart(3, "0");

  const atendimento = {
    ...criarAtendimento(proximoId, nomeCliente),
    telefone,
    origem: "WhatsApp",
    interesse: "—",
    mensagens: []
  };
  atendimentos = [atendimento, ...atendimentos];
  notificar();
  return atendimento;
}
