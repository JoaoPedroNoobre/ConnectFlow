/* ==========================================================================
   Tela 2 — WhatsApp Integrado
   Caixa de entrada com atendimento automatizado por IA e possibilidade de
   intervenção humana. Usa as funções de js/atendimentos.js e js/whatsapp.js.
   ========================================================================== */

import { STATUS, filtrarAtendimentos } from "../atendimentos.js";
import { gerarLinkWhatsApp } from "../whatsapp.js";
import {
  listarAtendimentos, buscarAtendimento, inscrever,
  mudarStatus, adicionarMensagem, novoAtendimento
} from "../estado.js";
import {
  $, icone, escapar, iniciais, badgeStatus, horaAtual, formatarTelefone,
  toast, lerArmazenado, ROTULO_STATUS
} from "../ui.js";

const estado = { filtro: "todos", busca: "", selecionadoId: null };

const els = {};

export function iniciarWhatsApp() {
  els.layout = $("#chatLayout");
  els.filtros = $("#filtrosStatus");
  els.lista = $("#listaConversas");
  els.janela = $("#janelaChat");
  els.info = $("#infoCliente");
  els.busca = $("#buscaCliente");
  els.modal = $("#modalAtendimento");
  els.formModal = $("#formAtendimento");
  els.erroModal = $("#erroAtendimento");

  els.busca.addEventListener("input", () => {
    estado.busca = els.busca.value.trim().toLowerCase();
    renderizarLista();
  });

  els.filtros.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-filtro]");
    if (!chip) return;
    estado.filtro = chip.dataset.filtro;
    renderizarFiltros();
    renderizarLista();
  });

  els.lista.addEventListener("click", (e) => {
    const item = e.target.closest("[data-id]");
    if (item) location.hash = `whatsapp/${item.dataset.id}`;
  });

  $("#view-whatsapp").addEventListener("click", tratarAcao);
  els.janela.addEventListener("submit", enviarMensagem);
  configurarModal();

  inscrever(renderizarTudo);
  renderizarTudo();
}

/* Chamado pelo roteador: #whatsapp ou #whatsapp/<id> */
export function abrirConversa(id) {
  if (id && buscarAtendimento(id)) {
    estado.selecionadoId = id;
    els.layout.dataset.painel = "chat";
  } else {
    els.layout.dataset.painel = "lista";
    if (!estado.selecionadoId && window.matchMedia("(min-width: 769px)").matches) {
      estado.selecionadoId = listarAtendimentos()[0]?.id ?? null;
    }
  }
  els.layout.classList.remove("info-aberta");
  renderizarTudo();
}

function renderizarTudo() {
  renderizarFiltros();
  renderizarLista();
  renderizarJanela();
  renderizarInfo();
  atualizarBadgeMenu();
}

/* ---------- Lista ---------- */

function renderizarFiltros() {
  const todos = listarAtendimentos();
  const opcoes = [["todos", "Todos", todos.length]].concat(
    Object.values(STATUS).map((s) => [s, ROTULO_STATUS[s], filtrarAtendimentos(todos, s).length])
  );

  els.filtros.innerHTML = opcoes
    .map(([valor, rotulo, qtd]) => {
      const ativo = estado.filtro === valor;
      return `<button type="button" class="chip ${ativo ? "is-active" : ""}" data-filtro="${valor}"
                role="tab" aria-selected="${ativo}">${rotulo} <span class="chip__count">${qtd}</span></button>`;
    })
    .join("");
}

function renderizarLista() {
  let itens = listarAtendimentos();
  if (estado.filtro !== "todos") itens = filtrarAtendimentos(itens, estado.filtro);
  if (estado.busca) itens = itens.filter((a) => a.cliente.toLowerCase().includes(estado.busca));

  if (!itens.length) {
    els.lista.innerHTML = `
      <li class="empty-state">${icone("i-search")}
        <strong>Nenhuma conversa</strong><span>Altere o filtro ou a busca.</span></li>`;
    return;
  }

  els.lista.innerHTML = itens
    .map((a) => {
      const ultima = a.mensagens.at(-1);
      const ativo = a.id === estado.selecionadoId;
      return `
        <li>
          <button type="button" class="conversation ${ativo ? "is-active" : ""}" data-id="${a.id}"
                  ${ativo ? 'aria-current="true"' : ""}>
            <span class="avatar">${iniciais(a.cliente)}</span>
            <span class="conversation__body">
              <span class="conversation__row">
                <strong>${escapar(a.cliente)}</strong>
                <time>${escapar(ultima?.hora ?? "")}</time>
              </span>
              <span class="conversation__preview">${escapar(ultima?.texto ?? "Novo atendimento")}</span>
              ${badgeStatus(a.status)}
            </span>
          </button>
        </li>`;
    })
    .join("");
}

/* ---------- Conversa ---------- */

function nomeAgente() {
  return lerArmazenado("cf-agente")?.nome || "Flora";
}

function renderizarMensagem(m) {
  if (m.autor === "sistema") {
    return `<p class="msg-system">${escapar(m.texto)} · ${escapar(m.hora)}</p>`;
  }
  const classes = { cliente: "msg", ia: "msg msg--ia", humano: "msg msg--out" };
  const autor = {
    ia: `<span class="msg__author">${icone("i-sparkles")}${escapar(nomeAgente())} · IA</span>`,
    humano: `<span class="msg__author">${icone("i-user")}Atendente</span>`
  };
  return `
    <div class="${classes[m.autor]}">
      ${autor[m.autor] ?? ""}
      <p>${escapar(m.texto)}</p>
      <time>${escapar(m.hora)}</time>
    </div>`;
}

function botoesAcao(status) {
  const assumir = `<button class="btn btn--primary btn--sm" data-action="assumir" title="Assumir atendimento">${icone("i-user-check")}<span>Assumir</span></button>`;
  const porStatus = {
    [STATUS.EM_ATENDIMENTO]: assumir,
    [STATUS.AGUARDANDO_HUMANO]: assumir,
    [STATUS.ASSUMIDO]: `
      <button class="btn btn--secondary btn--sm" data-action="devolver-ia" title="Devolver para a IA">${icone("i-bot")}<span>Devolver à IA</span></button>
      <button class="btn btn--success btn--sm" data-action="resolver" title="Marcar como resolvido">${icone("i-check")}<span>Resolver</span></button>`,
    [STATUS.RESOLVIDO]: `<button class="btn btn--secondary btn--sm" data-action="reabrir" title="Reabrir atendimento">${icone("i-message")}<span>Reabrir</span></button>`
  };
  return porStatus[status];
}

function rodape(status) {
  if (status === STATUS.ASSUMIDO) {
    return `
      <form class="composer" data-form="mensagem">
        <label class="sr-only" for="campoMensagem">Mensagem</label>
        <input id="campoMensagem" name="mensagem" type="text" placeholder="Digite sua mensagem…" autocomplete="off" required>
        <button class="btn btn--primary btn--icon" type="submit" aria-label="Enviar mensagem">${icone("i-send")}</button>
      </form>`;
  }
  const textos = {
    [STATUS.EM_ATENDIMENTO]: [icone("i-sparkles"), "A IA está conduzindo este atendimento.", ""],
    [STATUS.AGUARDANDO_HUMANO]: [icone("i-clock"), "O cliente está aguardando um atendente.", ""],
    [STATUS.RESOLVIDO]: [icone("i-check-circle"), "Este atendimento foi resolvido.", "composer-lock--done"]
  };
  const [ic, texto, extra] = textos[status];
  const botao = status === STATUS.RESOLVIDO
    ? ""
    : `<button class="btn btn--primary btn--sm" data-action="assumir">${icone("i-user-check")}Assumir para responder</button>`;
  return `<div class="composer-lock ${extra}"><span>${ic}${texto}</span>${botao}</div>`;
}

function renderizarJanela() {
  const a = buscarAtendimento(estado.selecionadoId);
  if (!a) {
    els.janela.innerHTML = `
      <div class="empty-state">${icone("i-whatsapp")}
        <strong>Selecione uma conversa</strong>
        <span>As mensagens dos seus clientes aparecem aqui.</span></div>`;
    return;
  }

  els.janela.innerHTML = `
    <header class="chat-window__header">
      <button class="icon-btn chat-window__back" type="button" data-action="voltar-lista" aria-label="Voltar para a lista">${icone("i-arrow-left")}</button>
      <span class="avatar">${iniciais(a.cliente)}</span>
      <div class="chat-window__who">
        <strong>${escapar(a.cliente)}</strong>
        ${badgeStatus(a.status)}
      </div>
      <div class="chat-window__actions">
        ${botoesAcao(a.status)}
        <button class="icon-btn chat-window__info-btn" type="button" data-action="abrir-info" aria-label="Informações do cliente">${icone("i-info")}</button>
      </div>
    </header>
    <div class="messages" id="listaMensagens">
      ${a.mensagens.length ? a.mensagens.map(renderizarMensagem).join("") : '<p class="msg-system">Nenhuma mensagem ainda</p>'}
    </div>
    ${rodape(a.status)}`;

  const msgs = $("#listaMensagens");
  msgs.scrollTop = msgs.scrollHeight;
}

function renderizarInfo() {
  const a = buscarAtendimento(estado.selecionadoId);
  if (!a) {
    els.info.innerHTML = `<div class="empty-state">${icone("i-user")}<span>Nenhum cliente selecionado</span></div>`;
    return;
  }

  let link = "";
  try {
    link = gerarLinkWhatsApp(a.telefone);
  } catch {
    link = "";
  }

  els.info.innerHTML = `
    <div class="chat-info__head">
      <button class="icon-btn chat-info__close" type="button" data-action="fechar-info" aria-label="Fechar">${icone("i-x")}</button>
      <span class="avatar avatar--lg">${iniciais(a.cliente)}</span>
      <strong>${escapar(a.cliente)}</strong>
      ${badgeStatus(a.status)}
    </div>
    <dl class="info-list">
      <div><dt>Telefone</dt><dd>${escapar(formatarTelefone(a.telefone))}</dd></div>
      <div><dt>Origem do contato</dt><dd>${escapar(a.origem)}</dd></div>
      <div><dt>Interesse</dt><dd>${escapar(a.interesse)}</dd></div>
      <div><dt>Protocolo</dt><dd>#${escapar(a.id)}</dd></div>
    </dl>
    ${link ? `<a class="btn btn--whatsapp btn--block" href="${link}" target="_blank" rel="noopener noreferrer">${icone("i-external")}Abrir no WhatsApp</a>` : ""}`;
}

function atualizarBadgeMenu() {
  const qtd = filtrarAtendimentos(listarAtendimentos(), STATUS.AGUARDANDO_HUMANO).length;
  const badge = $("#badgeAguardando");
  badge.hidden = qtd === 0;
  badge.textContent = qtd;
  badge.setAttribute("aria-label", `${qtd} aguardando atendente`);
}

/* ---------- Ações ---------- */

function tratarAcao(e) {
  const botao = e.target.closest("[data-action]");
  if (!botao) return;
  const id = estado.selecionadoId;
  const hora = horaAtual();

  switch (botao.dataset.action) {
    case "assumir":
      mudarStatus(id, STATUS.ASSUMIDO, "Atendimento assumido por você", hora);
      toast("Você assumiu o atendimento. A IA foi pausada nesta conversa.");
      $("#campoMensagem")?.focus();
      break;
    case "devolver-ia":
      mudarStatus(id, STATUS.EM_ATENDIMENTO, "Conversa devolvida para a IA", hora);
      toast("A IA voltou a conduzir esta conversa.");
      break;
    case "resolver":
      mudarStatus(id, STATUS.RESOLVIDO, "Atendimento marcado como resolvido", hora);
      toast("Atendimento resolvido.");
      break;
    case "reabrir":
      mudarStatus(id, STATUS.EM_ATENDIMENTO, "Atendimento reaberto", hora);
      break;
    case "voltar-lista":
      location.hash = "whatsapp";
      break;
    case "abrir-info":
      els.layout.classList.add("info-aberta");
      break;
    case "fechar-info":
      els.layout.classList.remove("info-aberta");
      break;
    case "novo-atendimento":
      abrirModal();
      break;
  }
}

function enviarMensagem(e) {
  if (!e.target.matches('[data-form="mensagem"]')) return;
  e.preventDefault();
  const campo = e.target.elements.mensagem;
  const texto = campo.value.trim();
  if (!texto) return;
  adicionarMensagem(estado.selecionadoId, { autor: "humano", texto, hora: horaAtual() });
  $("#campoMensagem")?.focus();
}

/* ---------- Modal "Novo atendimento" ---------- */

function abrirModal() {
  els.formModal.reset();
  els.erroModal.hidden = true;
  els.modal.showModal();
  $("#novoNome").focus();
}

function configurarModal() {
  els.modal.addEventListener("click", (e) => {
    if (e.target === els.modal || e.target.closest('[data-action="fechar-modal"]')) els.modal.close();
  });

  els.formModal.addEventListener("submit", (e) => {
    e.preventDefault();
    const nome = els.formModal.elements.nome.value;
    const telefone = els.formModal.elements.telefone.value;

    try {
      gerarLinkWhatsApp(telefone); // valida o telefone (DDI + número)
      const criado = novoAtendimento(nome, telefone.replace(/\D/g, ""));
      els.modal.close();
      estado.filtro = "todos";
      location.hash = `whatsapp/${criado.id}`;
      toast(`Atendimento #${criado.id} criado para ${criado.cliente}.`);
    } catch (erro) {
      els.erroModal.textContent = erro.message;
      els.erroModal.hidden = false;
    }
  });
}
