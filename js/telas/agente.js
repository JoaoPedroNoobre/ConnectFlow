/* ==========================================================================
   Tela 3 â€” Agente de IA
   ConfiguraÃ§Ã£o do assistente virtual (Geral, CatÃ¡logo, Respostas e
   Comportamento) e uma prÃ©via que SIMULA localmente as respostas com base no
   catÃ¡logo. A IA real serÃ¡ conectada via API/n8n pelo backend do projeto.
   ========================================================================== */

import { catalogoDemo } from "../dados-demo.js";
import {
  $, $$, icone, escapar, formatarPreco, toast, horaAtual,
  lerArmazenado, gravarArmazenado, lerFormulario, configurarAbas
} from "../ui.js";

const CHAVE_AGENTE = "cf-agente";
const CHAVE_CATALOGO = "cf-catalogo";
let catalogo = lerArmazenado(CHAVE_CATALOGO, catalogoDemo);

export function iniciarAgente() {
  const form = $("#formAgente");
  configurarAbas(form);
  renderizarCatalogo();
  configurarContador();
  reiniciarTeste();
  atualizarIndicadoresIA();

  // CatÃ¡logo (campos sem <form> prÃ³prio para nÃ£o aninhar formulÃ¡rios)
  $('[data-action="adicionar-item"]').addEventListener("click", adicionarItem);
  $("#catalogoNovo").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      adicionarItem();
    }
  });
  $("#tabelaCatalogo").addEventListener("click", removerItem);

  // PrÃ©via
  $("#formTeste").addEventListener("submit", (e) => {
    e.preventDefault();
    const campo = $("#entradaTeste");
    perguntar(campo.value);
    campo.value = "";
  });
  $("#sugestoesTeste").addEventListener("click", (e) => {
    if (e.target.matches(".quick-btn")) perguntar(e.target.textContent);
  });
  $('[data-action="reiniciar-teste"]').addEventListener("click", reiniciarTeste);

  // Liga/desliga da IA (topo das telas WhatsApp e Agente de IA)
  $$("[data-ia-ativa]").forEach((caixa) =>
    caixa.addEventListener("change", () => definirIAAtiva(caixa.checked))
  );
  $('[data-action="alternar-ia"]').addEventListener("click", () => definirIAAtiva(!iaAtiva()));

  document.addEventListener("cf:salvo", (e) => {
    if (e.detail === CHAVE_AGENTE) {
      atualizarIndicadoresIA();
      reiniciarTeste();
    }
  });
}

/* ---------- IA ativa / pausada ---------- */

export function iaAtiva() {
  return $('input[name="ativo"][form="formAgente"]').checked;
}

function definirIAAtiva(ativa) {
  $$("[data-ia-ativa]").forEach((c) => { c.checked = ativa; });
  const salvo = lerArmazenado(CHAVE_AGENTE) ?? lerFormulario($("#formAgente"));
  gravarArmazenado(CHAVE_AGENTE, { ...salvo, ativo: ativa });
  document.dispatchEvent(new CustomEvent("cf:salvo", { detail: CHAVE_AGENTE }));
  toast(ativa ? "IA ativada: ela volta a responder os clientes." : "IA pausada: novas conversas aguardam um atendente.");
}

function atualizarIndicadoresIA() {
  const ativa = iaAtiva();
  $$("[data-ia-ativa]").forEach((c) => { c.checked = ativa; });
  $$(".ai-pill").forEach((p) => p.classList.toggle("is-off", !ativa));
  $$("[data-ia-rotulo]").forEach((r) => { r.textContent = ativa ? "IA Ativa" : "IA pausada"; });
  const botao = $('[data-action="alternar-ia"]');
  botao.querySelector("[data-ia-botao]").textContent = ativa ? "Pausar IA" : "Retomar IA";
  botao.querySelector("use").setAttribute("href", `assets/icons.svg#${ativa ? "i-pause" : "i-play"}`);
}

/* ---------- Contador das instruÃ§Ãµes ---------- */

function configurarContador() {
  const campo = $("#agInstrucoes");
  const contador = $("#contadorInstrucoes");
  const atualizar = () => {
    contador.textContent = `${campo.value.length}/${campo.maxLength}`;
    contador.classList.toggle("is-warning", campo.value.length > campo.maxLength * 0.9);
  };
  campo.addEventListener("input", atualizar);
  atualizar();
}

/* ---------- CatÃ¡logo ---------- */

function renderizarCatalogo() {
  const corpo = $("#tabelaCatalogo");
  if (!catalogo.length) {
    corpo.innerHTML = `<tr><td colspan="4"><div class="empty-state">${icone("i-package")}
      <strong>CatÃ¡logo vazio</strong><span>Adicione produtos ou serviÃ§os para a IA consultar.</span></div></td></tr>`;
    return;
  }
  corpo.innerHTML = catalogo
    .map((item) => `
      <tr>
        <td><strong>${escapar(item.nome)}</strong></td>
        <td>${escapar(item.categoria || "â€”")}</td>
        <td class="num">${formatarPreco(item.preco)}</td>
        <td><button class="icon-btn icon-btn--danger" type="button" data-remover="${item.id}" aria-label="Remover ${escapar(item.nome)}">${icone("i-trash")}</button></td>
      </tr>`)
    .join("");
}

function salvarCatalogo() {
  gravarArmazenado(CHAVE_CATALOGO, catalogo);
  renderizarCatalogo();
}

function adicionarItem() {
  const nomeCampo = $("#catNome");
  const precoCampo = $("#catPreco");
  const nome = nomeCampo.value.trim();
  const preco = Number(precoCampo.value);
  const precoValido = precoCampo.value !== "" && preco >= 0;

  nomeCampo.setAttribute("aria-invalid", String(!nome));
  precoCampo.setAttribute("aria-invalid", String(!precoValido));
  if (!nome || !precoValido) {
    toast("Informe o nome e um preÃ§o vÃ¡lido.", "erro");
    return;
  }

  catalogo = [...catalogo, { id: Date.now(), nome, categoria: $("#catCategoria").value.trim(), preco }];
  salvarCatalogo();
  [nomeCampo, $("#catCategoria"), precoCampo].forEach((c) => { c.value = ""; });
  nomeCampo.focus();
  toast(`"${nome}" adicionado ao catÃ¡logo.`);
}

function removerItem(e) {
  const botao = e.target.closest("[data-remover]");
  if (!botao) return;
  const id = Number(botao.dataset.remover);
  const item = catalogo.find((i) => i.id === id);
  catalogo = catalogo.filter((i) => i.id !== id);
  salvarCatalogo();
  toast(`"${item?.nome}" removido do catÃ¡logo.`);
}

/* ---------- PrÃ©via do agente (simulaÃ§Ã£o local) ---------- */

const normalizar = (t) => t.normalize("NFD").replace(/[Ì€-Í¯]/g, "").toLowerCase();

function adicionarMensagemTeste(autor, texto) {
  const area = $("#mensagensTeste");
  const el = document.createElement(autor === "sistema" ? "p" : "div");
  if (autor === "sistema") {
    el.className = "msg-system";
    el.textContent = texto;
  } else {
    el.className = autor === "ia" ? "msg msg--ia" : "msg msg--cliente";
    el.innerHTML = `${autor === "ia" ? `<span class="msg__author">${icone("i-sparkles")}${escapar(lerFormulario($("#formAgente")).nome || "IA")}</span>` : ""}
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
  else adicionarMensagemTeste("sistema", "IA pausada â€” as conversas aguardam um atendente");
}


async function perguntar(texto) {
  const pergunta = texto.trim();

  if (!pergunta) return;

  adicionarMensagemTeste("cliente", pergunta);

  // Verifica se a IA estÃ¡ ativada
  if (!iaAtiva()) {
    adicionarMensagemTeste("sistema", "IA pausada. Aguarde um atendente.");
    return;
  }

  const digitando = adicionarMensagemTeste("sistema", "digitandoâ€¦");

  try {
    // Busca as informaÃ§Ãµes da empresa
    const dadosEmpresa = lerArmazenado("cf-empresa") || {};

    const empresa = {
      nome: dadosEmpresa.nome || "Confeitaria ConnectFlow",
      descricao: dadosEmpresa.descricao || "Confeitaria de bolos e doces.",
      endereco: dadosEmpresa.endereco || "NÃ£o informado",
      horario: dadosEmpresa.horario || "NÃ£o informado"
    };

    // Envia a pergunta ao nosso servidor
    const resposta = await fetch("/api/ia", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        empresa: empresa,
        produtos: catalogo,
        pergunta: pergunta,
        config: lerFormulario($("#formAgente"
        ))
      })

    });

    if (!resposta.ok) {
      throw new Error("Erro ao consultar a IA");
    }

    const dados = await resposta.json();

    adicionarMensagemTeste("ia", dados.resposta);

  } catch (erro) {
    adicionarMensagemTeste(
      "sistema",
      "NÃ£o foi possÃ­vel consultar a IA. Tente novamente."
    );
  } finally {
    digitando.remove();
  }
}


/* Retorna uma lista de mensagens [autor, texto] */
function gerarResposta(pergunta) {
  const cfg = lerFormulario($("#formAgente"));
  const empresa = lerArmazenado("cf-empresa") ?? {};
  const t = normalizar(pergunta);
  const fecho = ["consultivo", "descontraido"].includes(cfg.tom) ? " ðŸ˜Š" : "";
  const ia = (texto) => [["ia", texto]];
  const transferir = (motivo) => [
    ["ia", cfg.msgTransferencia],
    ["sistema", `${motivo} â†’ conversa movida para "Aguardando humano"`]
  ];

  if (!cfg.ativo) return [["sistema", "IA pausada â€” a conversa aguarda um atendente"]];

  if (cfg.transfPedido && /atendente|humano|pessoa|gerente/.test(t)) return transferir("Cliente pediu um atendente");
  if (cfg.transfReclamacao && /reclama|atras|problema|errad|pessim/.test(t)) return transferir("ReclamaÃ§Ã£o identificada");
  if (cfg.transfNegociacao && /desconto|negoci|mais barato|agend/.test(t)) return transferir("Pedido de negociaÃ§Ã£o ou agendamento");

  if (/^(oi|ola|bom dia|boa tarde|boa noite)\b/.test(t)) return ia(cfg.boasVindas);

  // Busca um item do catÃ¡logo citado na pergunta
  const palavrasDe = (nome) => normalizar(nome).split(/\W+/).filter((p) => p.length > 3);
  const item = catalogo.find((i) => palavrasDe(i.nome).length && palavrasDe(i.nome).every((p) => t.includes(p)))
    ?? catalogo.find((i) => palavrasDe(i.nome).some((p) => p.length > 4 && t.includes(p)));

  if (item && (cfg.habCatalogo || cfg.habPrecos)) {
    let resposta = cfg.habPrecos ? `${item.nome} custa ${formatarPreco(item.preco)}.` : `Temos ${item.nome} disponÃ­vel.`;
    if (cfg.habApresentar) {
      const sugestao = catalogo.find((i) => i.id !== item.id && i.categoria === item.categoria)
        ?? catalogo.find((i) => i.id !== item.id);
      if (sugestao) resposta += ` VocÃª tambÃ©m pode gostar de: ${sugestao.nome}.`;
    }
    return ia(resposta + fecho);
  }

  const querPrecos = /preco|valor|quanto/.test(t);
  if ((cfg.habCatalogo && /produto|catalogo|cardapio|opcoes|vende|servico|tem o que|quais/.test(t)) || (cfg.habPrecos && querPrecos)) {
    if (!catalogo.length) return ia("No momento nosso catÃ¡logo estÃ¡ sendo atualizado.");
    const comPreco = cfg.habPrecos;
    const lista = catalogo.map((i) => (comPreco ? `â€¢ ${i.nome}: ${formatarPreco(i.preco)}` : `â€¢ ${i.nome}`)).join("\n");
    return ia(`${querPrecos ? "Confira nossos preÃ§os" : "Este Ã© o nosso catÃ¡logo"}:\n${lista}\nSobre qual deseja saber mais?${fecho}`);
  }

  if (cfg.habDuvidas && /horario|abre|fecha|funciona/.test(t)) {
    return ia(`Nosso horÃ¡rio de atendimento Ã©: ${empresa.horario || "Seg. a sÃ¡b., 8h Ã s 18h"}.${fecho}`);
  }
  if (cfg.habDuvidas && /endereco|onde fica|localiza/.test(t)) {
    return ia(empresa.endereco ? `Estamos em: ${empresa.endereco}.` : "O endereÃ§o ainda nÃ£o foi cadastrado nas configuraÃ§Ãµes da empresa.");
  }

  if (cfg.transfSemResposta) return transferir("A IA nÃ£o encontrou uma resposta");
  return ia("Desculpe, nÃ£o entendi. Pode reformular a pergunta?");
}
