/* ==========================================================================
   Tela 3 — Agente de IA
   Configuração do assistente virtual (identidade, habilidades, regras de
   transferência para humano), catálogo de produtos/serviços e uma área de
   teste que SIMULA localmente as respostas com base no catálogo.
   A IA real será conectada via API/n8n pelo backend do projeto.
   ========================================================================== */

import { catalogoDemo } from "../dados-demo.js";
import {
  $, icone, escapar, formatarPreco, toast, horaAtual,
  lerArmazenado, gravarArmazenado, lerFormulario
} from "../ui.js";

const CHAVE_CATALOGO = "cf-catalogo";
let catalogo = lerArmazenado(CHAVE_CATALOGO, catalogoDemo);

export function iniciarAgente() {
  renderizarCatalogo();
  reiniciarTeste();
  atualizarStatusAgente();

  $("#formCatalogo").addEventListener("submit", adicionarItem);
  $("#tabelaCatalogo").addEventListener("click", removerItem);
  $("#formTeste").addEventListener("submit", (e) => {
    e.preventDefault();
    const campo = $("#entradaTeste");
    perguntar(campo.value);
    campo.value = "";
  });
  $("#sugestoesTeste").addEventListener("click", (e) => {
    if (e.target.matches(".chip")) perguntar(e.target.textContent);
  });
  $('[data-action="reiniciar-teste"]').addEventListener("click", reiniciarTeste);

  document.addEventListener("cf:salvo", (e) => {
    if (e.detail === "cf-agente") {
      atualizarStatusAgente();
      reiniciarTeste();
    }
  });
}

/* Indicador "Agente ativo" no rodapé do menu lateral */
export function atualizarStatusAgente() {
  const cfg = lerArmazenado("cf-agente") ?? lerFormulario($("#formAgente"));
  const ativo = cfg.ativo !== false;
  $("#agenteStatusNome").textContent = `${cfg.nome || "Assistente"} · Agente de IA`;
  $("#agenteStatusTexto").textContent = ativo ? "Ativo e respondendo" : "Pausado";
  $("#agenteStatusDot").classList.toggle("is-off", !ativo);
}

/* ---------- Catálogo ---------- */

function renderizarCatalogo() {
  const corpo = $("#tabelaCatalogo");
  if (!catalogo.length) {
    corpo.innerHTML = `<tr><td colspan="4"><div class="empty-state">${icone("i-package")}
      <strong>Catálogo vazio</strong><span>Adicione produtos ou serviços para a IA consultar.</span></div></td></tr>`;
    return;
  }
  corpo.innerHTML = catalogo
    .map((item) => `
      <tr>
        <td><strong>${escapar(item.nome)}</strong></td>
        <td>${escapar(item.categoria || "—")}</td>
        <td class="num">${formatarPreco(item.preco)}</td>
        <td><button class="icon-btn" type="button" data-remover="${item.id}" aria-label="Remover ${escapar(item.nome)}">${icone("i-trash")}</button></td>
      </tr>`)
    .join("");
}

function salvarCatalogo() {
  gravarArmazenado(CHAVE_CATALOGO, catalogo);
  renderizarCatalogo();
}

function adicionarItem(e) {
  e.preventDefault();
  const form = e.target;
  const nome = form.elements.nome.value.trim();
  const preco = Number(form.elements.preco.value);

  form.elements.nome.setAttribute("aria-invalid", String(!nome));
  form.elements.preco.setAttribute("aria-invalid", String(!form.elements.preco.value || preco < 0));
  if (!nome || !form.elements.preco.value || preco < 0) {
    toast("Informe o nome e um preço válido.", "erro");
    return;
  }

  catalogo = [...catalogo, { id: Date.now(), nome, categoria: form.elements.categoria.value.trim(), preco }];
  salvarCatalogo();
  form.reset();
  form.elements.nome.focus();
  toast(`"${nome}" adicionado ao catálogo.`);
}

function removerItem(e) {
  const botao = e.target.closest("[data-remover]");
  if (!botao) return;
  const id = Number(botao.dataset.remover);
  const item = catalogo.find((i) => i.id === id);
  catalogo = catalogo.filter((i) => i.id !== id);
  salvarCatalogo();
  toast(`"${item?.nome}" removido do catálogo.`);
}

/* ---------- Teste do agente (simulação local) ---------- */

const normalizar = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function adicionarMensagemTeste(autor, texto) {
  const area = $("#mensagensTeste");
  const el = document.createElement(autor === "sistema" ? "p" : "div");
  if (autor === "sistema") {
    el.className = "msg-system";
    el.textContent = texto;
  } else {
    el.className = autor === "ia" ? "msg msg--ia" : "msg msg--cliente";
    el.innerHTML = `${autor === "ia" ? `<span class="msg__author">${icone("i-sparkles")}IA</span>` : ""}
      <p>${escapar(texto)}</p><time>${horaAtual()}</time>`;
  }
  area.append(el);
  area.scrollTop = area.scrollHeight;
  return el;
}

function reiniciarTeste() {
  $("#mensagensTeste").innerHTML = "";
  const cfg = lerFormulario($("#formAgente"));
  if (cfg.ativo) adicionarMensagemTeste("ia", cfg.boasVindas);
  else adicionarMensagemTeste("sistema", "Agente desativado — as conversas aguardam um atendente");
}

function perguntar(texto) {
  const pergunta = texto.trim();
  if (!pergunta) return;
  adicionarMensagemTeste("cliente", pergunta);

  const digitando = adicionarMensagemTeste("sistema", "digitando…");
  setTimeout(() => {
    digitando.remove();
    const { autor, texto: resposta } = gerarResposta(pergunta);
    adicionarMensagemTeste(autor, resposta);
  }, 650);
}

function gerarResposta(pergunta) {
  const cfg = lerFormulario($("#formAgente"));
  const empresa = lerArmazenado("cf-empresa") ?? {};
  const t = normalizar(pergunta);
  const transferir = (motivo) => ({ autor: "sistema", texto: `${motivo} → conversa transferida para "Aguardando humano"` });
  const fecho = cfg.tom === "amigavel" ? " 😊" : "";

  if (!cfg.ativo) return transferir("Agente desativado");

  if (cfg.transfPedido && /atendente|humano|pessoa|gerente/.test(t)) return transferir("Cliente pediu um atendente");
  if (cfg.transfReclamacao && /reclama|atras|problema|errad|pessim/.test(t)) return transferir("Reclamação identificada");
  if (cfg.transfNegociacao && /desconto|negoci|mais barato/.test(t)) return transferir("Pedido de negociação");

  if (/^(oi|ola|bom dia|boa tarde|boa noite)\b/.test(t)) return { autor: "ia", texto: cfg.boasVindas };

  // Busca um item do catálogo citado na pergunta
  const item = catalogo.find((i) => {
    const palavras = normalizar(i.nome).split(/\W+/).filter((p) => p.length > 3);
    return palavras.length && palavras.every((p) => t.includes(p));
  }) ?? catalogo.find((i) => normalizar(i.nome).split(/\W+/).some((p) => p.length > 4 && t.includes(p)));

  if (item && (cfg.habCatalogo || cfg.habPrecos)) {
    let resposta = cfg.habPrecos
      ? `${item.nome} custa ${formatarPreco(item.preco)}.`
      : `Temos ${item.nome} disponível.`;
    if (cfg.habApresentar) {
      const sugestao = catalogo.find((i) => i.id !== item.id && i.categoria === item.categoria)
        ?? catalogo.find((i) => i.id !== item.id);
      if (sugestao) resposta += ` Você também pode gostar de: ${sugestao.nome}.`;
    }
    return { autor: "ia", texto: resposta + fecho };
  }

  if (cfg.habCatalogo && /produto|catalogo|cardapio|opcoes|vende|servico|tem o que|quais/.test(t)) {
    if (!catalogo.length) return { autor: "ia", texto: "No momento nosso catálogo está sendo atualizado." };
    const lista = catalogo
      .map((i) => (cfg.habPrecos ? `${i.nome} (${formatarPreco(i.preco)})` : i.nome))
      .join(", ");
    return { autor: "ia", texto: `Temos: ${lista}. Sobre qual deseja saber mais?${fecho}` };
  }

  if (cfg.habDuvidas && /horario|abre|fecha|funciona/.test(t)) {
    return { autor: "ia", texto: `Nosso horário de atendimento é: ${empresa.horario || "Seg. a sáb., 8h às 18h"}.${fecho}` };
  }
  if (cfg.habDuvidas && /endereco|onde fica|localiza/.test(t)) {
    return { autor: "ia", texto: empresa.endereco ? `Estamos em: ${empresa.endereco}.` : "O endereço ainda não foi cadastrado nas configurações da empresa." };
  }

  if (cfg.transfSemResposta) return transferir("A IA não encontrou uma resposta");
  return { autor: "ia", texto: "Desculpe, não entendi. Pode reformular a pergunta?" };
}
