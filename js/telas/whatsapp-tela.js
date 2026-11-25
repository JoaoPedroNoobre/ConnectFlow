/* ==========================================================================
   Tela 2 — WhatsApp Integrado
   Caixa de entrada com atendimento automatizado por IA e possibilidade de
   intervenção humana. Usa as funções de js/atendimentos.js e js/whatsapp.js.
   ========================================================================== */

import { STATUS, filtrarAtendimentos } from "../atendimentos.js";
import { gerarLinkWhatsApp } from "../whatsapp.js";
import { consultarGemini, iaAtiva } from "./agente.js";
import {
  listarAtendimentos, buscarAtendimento, inscrever,
  carregarAtendimentos, mudarStatus, adicionarMensagem, novoAtendimento
} from "../estado.js";
import {
  $, icone, escapar, iniciais, badgeStatus, horaAtual, formatarTelefone,
  toast, lerArmazenado, corAvatar, ROTULO_STATUS, ROTULO_FILTRO
} from "../ui.js";

const estado = { filtro: "todos", busca: "", selecionadoId: null, carregando: false, erroCarregamento: "" };
// Guarda a consulta em andamento de cada conversa.
const consultasIA = new Map();

const els = {};

// Liga os controles da tela e inicia a busca dos atendimentos salvos.
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
  els.botaoNovo = $('[data-action="novo-atendimento"]');

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
  els.janela.addEventListener("submit", tratarEnvio);
  document.addEventListener("cf:salvo", atualizarPausaIA);
  configurarModal();

  inscrever(renderizarTudo);
  renderizarTudo();
  carregarConversas();
}

// Atualiza a lista sem mudar a tela que o usuário está visitando.
async function carregarConversas() {
  if (estado.carregando) return;
  estado.carregando = true;
  estado.erroCarregamento = "";
  els.botaoNovo.disabled = true;
  renderizarLista();

  try {
    await carregarAtendimentos();
    if (document.body.dataset.tela === "whatsapp") {
      abrirConversa(location.hash.split("/")[1]);
    }
  } catch (erro) {
    estado.erroCarregamento = erro.message;
  } finally {
    estado.carregando = false;
    els.botaoNovo.disabled = false;
    renderizarLista();
  }
}

/* Chamado pelo roteador: #whatsapp ou #whatsapp/<id> */
export function abrirConversa(id) {
  if (id && buscarAtendimento(id)) {
    estado.selecionadoId = id;
    els.layout.classList.add("mostrando-conversa");
    els.layout.classList.remove("mostrando-lista");
  } else {
    els.layout.classList.add("mostrando-lista");
    els.layout.classList.remove("mostrando-conversa");
    if (!estado.selecionadoId && window.matchMedia("(min-width: 769px)").matches) {
      estado.selecionadoId = listarAtendimentos()[0]?.id ?? null;
    }
  }
  els.layout.classList.remove("painel-cliente-aberto");
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
    Object.values(STATUS).map((s) => [s, ROTULO_FILTRO[s], filtrarAtendimentos(todos, s).length])
  );

  els.filtros.innerHTML = opcoes
    .map(([valor, rotulo, qtd]) => {
      const ativo = estado.filtro === valor;
      return `<button type="button" class="filtro ${ativo ? "ativo" : ""}" data-filtro="${valor}"
                role="tab" aria-selected="${ativo}">${rotulo} (${qtd})</button>`;
    })
    .join("");
}

// Mostra a busca, os filtros e o resultado da leitura do Supabase.
function renderizarLista() {
  const atendimentos = listarAtendimentos();
  let itens = atendimentos;
  if (estado.filtro !== "todos") itens = filtrarAtendimentos(itens, estado.filtro);
  if (estado.busca) itens = itens.filter((a) => a.cliente.toLowerCase().includes(estado.busca));

  let aviso = "";
  if (estado.carregando) {
    aviso = '<li class="estado-vazio" role="status">Carregando atendimentos…</li>';
  } else if (estado.erroCarregamento) {
    aviso = `
      <li class="estado-vazio">
        <p role="alert">${escapar(estado.erroCarregamento)}</p>
        <button type="button" class="botao botao-contorno botao-pequeno" data-action="recarregar-atendimentos">Tentar novamente</button>
      </li>`;
  }

  if (!itens.length) {
    if (aviso) {
      els.lista.innerHTML = aviso;
      return;
    }
    const dica = atendimentos.length
      ? "Altere o filtro ou a busca."
      : "Use Novo atendimento para iniciar uma conversa.";
    els.lista.innerHTML = `
      <li class="empty-state">${icone("i-search")}
        <strong>Nenhuma conversa</strong><span>${dica}</span></li>`;
    return;
  }

  els.lista.innerHTML = aviso + itens
    .map((a) => {
      const ultima = a.mensagens.at(-1);
      const ativo = a.id === estado.selecionadoId;
      return `
        <li>
          <button type="button" class="item-conversa ${ativo ? "ativo" : ""}" data-id="${a.id}"
                  ${ativo ? 'aria-current="true"' : ""}>
            <span class="avatar avatar-cor-${corAvatar(a.cliente)}">${iniciais(a.cliente)}</span>
            <span class="item-conversa-texto">
              <span class="item-conversa-linha">
                <strong>${escapar(a.cliente)}</strong>
                <time>${escapar(ultima?.hora ?? "")}</time>
              </span>
              <span class="item-conversa-previa">${escapar(ultima?.texto ?? "Novo atendimento")}</span>
              ${badgeStatus(a.status)}
            </span>
          </button>
        </li>`;
    })
    .join("");
}

/* ---------- Conversa ---------- */

function nomeAgente() {
  return $("#agNome").value || "Assistente";
}

function renderizarMensagem(m) {
  if (m.autor === "sistema") {
    return `<p class="mensagem-sistema">${escapar(m.texto)} · ${escapar(m.hora)}</p>`;
  }
  const classes = { cliente: "mensagem", ia: "mensagem mensagem-ia", humano: "mensagem mensagem-atendente" };
  const autor = {
    ia: `<span class="mensagem-autor">${icone("i-sparkles")}${escapar(nomeAgente())} · IA</span>`,
    humano: `<span class="mensagem-autor">${icone("i-user")}Atendente</span>`
  };
  return `
    <div class="${classes[m.autor]}">
      ${autor[m.autor] ?? ""}
      <p>${escapar(m.texto)}</p>
      <time>${escapar(m.hora)}</time>
    </div>`;
}

function botoesAcao(status) {
  const assumir = `<button class="botao botao-roxo botao-pequeno" data-action="assumir" title="Assumir atendimento">${icone("i-user-check")}<span>Assumir</span></button>`;
  const porStatus = {
    [STATUS.EM_ATENDIMENTO]: assumir,
    [STATUS.AGUARDANDO_HUMANO]: assumir,
    [STATUS.ASSUMIDO]: `
      <button class="botao botao-secundario botao-pequeno" data-action="devolver-ia" title="Devolver para a IA">${icone("i-bot")}<span>Devolver à IA</span></button>
      <button class="botao botao-verde botao-pequeno" data-action="resolver" title="Marcar como resolvido">${icone("i-check")}<span>Resolver</span></button>`,
    [STATUS.RESOLVIDO]: `<button class="botao botao-secundario botao-pequeno" data-action="reabrir" title="Reabrir atendimento">${icone("i-message")}<span>Reabrir</span></button>`
  };
  return porStatus[status];
}

function rodape(status) {
  if (status === STATUS.ASSUMIDO) {
    return `
      <form class="caixa-digitar" data-form="mensagem">
        <label class="texto-leitor-tela" for="campoMensagem">Mensagem</label>
        <input id="campoMensagem" name="mensagem" type="text" placeholder="Digite sua mensagem…" autocomplete="off" required>
        <button class="botao botao-roxo botao-so-icone" type="submit" aria-label="Enviar mensagem">${icone("i-send")}</button>
      </form>`;
  }
  const textos = {
    [STATUS.EM_ATENDIMENTO]: [icone("i-sparkles"), iaAtiva() ? "A IA está conduzindo este atendimento." : "A IA está pausada.", ""],
    [STATUS.AGUARDANDO_HUMANO]: [icone("i-clock"), "O cliente está aguardando um atendente.", "composer-lock--wait"],
    [STATUS.RESOLVIDO]: [icone("i-check-circle"), "Este atendimento foi resolvido.", "composer-lock--done"]
  };
  const [ic, texto, extra] = textos[status];
  const botao = status === STATUS.RESOLVIDO
    ? ""
    : `<button class="botao botao-roxo botao-pequeno" data-action="assumir">${icone("i-user-check")}Assumir para responder</button>`;
  return `<div class="aviso-bloqueado ${extra}"><span>${ic}${texto}</span>${botao}</div>`;
}

// Usa o mesmo estilo do campo de atendimento, com uma ação separada.
function formularioSimulacao(consultando) {
  return `
    <form class="composer" data-form="mensagem-cliente">
      <label class="sr-only" for="campoCliente">Mensagem simulada do cliente</label>
      <input id="campoCliente" name="mensagem" type="text" placeholder="Simule uma mensagem do cliente…" autocomplete="off" required>
      <button class="btn btn--secondary btn--sm" type="submit" ${consultando ? "disabled" : ""}>Simular</button>
    </form>`;
}

function renderizarJanela() {
  const a = buscarAtendimento(estado.selecionadoId);
  if (!a) {
    delete els.janela.dataset.atendimento;
    els.janela.innerHTML = `
      <div class="estado-vazio">${icone("i-whatsapp")}
        <strong>Selecione uma conversa</strong>
        <span>As mensagens dos seus clientes aparecem aqui.</span></div>`;
    return;
  }

  // Uma resposta pode chegar enquanto a pessoa ainda está digitando.
  const campos = {};
  const foco = document.activeElement;
  if (els.janela.dataset.atendimento === a.id) {
    for (const campo of els.janela.querySelectorAll("form.composer input")) {
      campos[campo.id] = { texto: campo.value, focado: campo === foco };
    }
  }

  const consultando = consultasIA.has(a.id);
  const link = linkWhatsApp(a.telefone);
  els.janela.dataset.atendimento = a.id;
  els.janela.innerHTML = `
    <header class="janela-conversa-topo">
      <button class="botao-icone botao-voltar-lista" type="button" data-action="voltar-lista" aria-label="Voltar para a lista">${icone("i-arrow-left")}</button>
      <span class="avatar avatar-cor-${corAvatar(a.cliente)}">${iniciais(a.cliente)}</span>
      <div class="janela-conversa-cliente">
        <strong>${escapar(a.cliente)}</strong>
        ${badgeStatus(a.status)}
      </div>
      <div class="janela-conversa-acoes">
        ${botoesAcao(a.status)}
        ${link ? `<a class="icon-btn" href="${link}" target="_blank" rel="noopener noreferrer" aria-label="Abrir conversa no WhatsApp" title="Abrir no WhatsApp">${icone("i-phone")}</a>` : ""}
        <button class="icon-btn" type="button" data-action="abrir-info" aria-label="Informações do cliente" title="Informações do cliente">${icone("i-more")}</button>
      </div>
    </header>
    <div class="messages" id="listaMensagens">
      ${a.mensagens.length ? a.mensagens.map(renderizarMensagem).join("") : '<p class="msg-system">Nenhuma mensagem ainda</p>'}
      ${consultando ? '<p class="msg-system">Consultando o Gemini…</p>' : ""}
    </div>
    ${a.status !== STATUS.RESOLVIDO ? formularioSimulacao(consultando) : ""}
    ${rodape(a.status)}`;

  for (const campo of els.janela.querySelectorAll("form.composer input")) {
    const rascunho = campos[campo.id];
    if (!rascunho) continue;
    campo.value = rascunho.texto;
    if (rascunho.focado) campo.focus({ preventScroll: true });
  }

  const msgs = $("#listaMensagens");
  msgs.scrollTop = msgs.scrollHeight;
}

/* Link wa.me gerado com js/whatsapp.js ("" se o telefone for inválido) */
function linkWhatsApp(telefone) {
  try {
    return gerarLinkWhatsApp(telefone);
  } catch {
    return "";
  }
}

function renderizarInfo() {
  const a = buscarAtendimento(estado.selecionadoId);
  if (!a) {
    els.info.innerHTML = `<div class="estado-vazio">${icone("i-user")}<span>Nenhum cliente selecionado</span></div>`;
    return;
  }

  const link = linkWhatsApp(a.telefone);

  els.info.innerHTML = `
    <div class="painel-cliente-topo">
      <button class="botao-icone botao-fechar-painel" type="button" data-action="fechar-info" aria-label="Fechar">${icone("i-x")}</button>
      <span class="avatar avatar-grande avatar-cor-${corAvatar(a.cliente)}">${iniciais(a.cliente)}</span>
      <strong>${escapar(a.cliente)}</strong>
      ${badgeStatus(a.status)}
    </div>
    <dl class="lista-dados-cliente">
      <div><dt>Telefone</dt><dd>${escapar(formatarTelefone(a.telefone) || "—")}</dd></div>
      <div><dt>Origem do contato</dt><dd>${escapar(a.origem)}</dd></div>
      <div><dt>Interesse</dt><dd>${escapar(a.interesse)}</dd></div>
      <div><dt>Protocolo</dt><dd>#${escapar(a.id)}</dd></div>
    </dl>
    ${link ? `<a class="botao botao-whatsapp botao-largura-total" href="${link}" target="_blank" rel="noopener noreferrer">${icone("i-external")}Abrir no WhatsApp</a>` : ""}`;
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
      cancelarConsultaIA(id);
      mudarStatus(id, STATUS.ASSUMIDO, "Atendimento assumido por você", hora);
      toast("Você assumiu o atendimento. A IA foi pausada nesta conversa.");
      $("#campoMensagem")?.focus();
      break;
    case "devolver-ia":
      mudarStatus(id, STATUS.EM_ATENDIMENTO, "Conversa devolvida para a IA", hora);
      toast(iaAtiva() ? "A IA voltou a conduzir esta conversa." : "Conversa devolvida. A IA continua pausada.");
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
      els.layout.classList.add("painel-cliente-aberto");
      break;
    case "fechar-info":
      els.layout.classList.remove("painel-cliente-aberto");
      break;
    case "novo-atendimento":
      abrirModal();
      break;
    case "recarregar-atendimentos":
      carregarConversas();
      break;
  }
}

// Distingue o envio humano da mensagem simulada do cliente.
function tratarEnvio(e) {
  const tipo = e.target.dataset.form;
  if (tipo !== "mensagem" && tipo !== "mensagem-cliente") return;
  e.preventDefault();

  const atendimento = buscarAtendimento(estado.selecionadoId);
  if (!atendimento || atendimento.status === STATUS.RESOLVIDO) return;

  const campo = e.target.elements.mensagem;
  const texto = campo.value.trim();
  if (!texto) return;

  if (tipo === "mensagem-cliente") {
    if (consultasIA.has(atendimento.id)) return;
    campo.value = "";
    receberMensagemCliente(atendimento, texto);
    $("#campoCliente")?.focus();
    return;
  }

  if (atendimento.status !== STATUS.ASSUMIDO) return;
  campo.value = "";
  adicionarMensagem(atendimento.id, { autor: "humano", texto, hora: horaAtual() });
  $("#campoMensagem")?.focus();
}

// Registra a mensagem do cliente, mesmo quando a IA não pode responder.
async function receberMensagemCliente(atendimento, texto) {
  const id = atendimento.id;
  let consulta = null;

  if (atendimento.status === STATUS.EM_ATENDIMENTO && iaAtiva()) {
    consulta = new AbortController();
    consultasIA.set(id, consulta);
  }
  adicionarMensagem(id, { autor: "cliente", texto, hora: horaAtual() });
  if (!consulta) return;

  let mensagem;
  try {
    const resposta = await consultarGemini(texto, consulta.signal);
    mensagem = { autor: "ia", texto: resposta };
  } catch (erro) {
    mensagem = { autor: "sistema", texto: erro.message };
  }

  // Uma consulta cancelada já saiu da lista e pode ter sido substituída.
  if (consultasIA.get(id) !== consulta) return;
  consultasIA.delete(id);
  if (buscarAtendimento(id)?.status === STATUS.EM_ATENDIMENTO && iaAtiva()) {
    adicionarMensagem(id, { ...mensagem, hora: horaAtual() });
  } else {
    renderizarJanela();
  }
}

// Descarta respostas pendentes quando a pessoa assume ou pausa a IA.
function cancelarConsultaIA(id) {
  consultasIA.get(id)?.abort();
  consultasIA.delete(id);
}

function atualizarPausaIA(e) {
  if (e.detail !== "cf-agente") return;
  if (!iaAtiva()) {
    for (const id of consultasIA.keys()) cancelarConsultaIA(id);
  }
  renderizarJanela();
}

/* ---------- Modal "Novo atendimento" ---------- */

function abrirModal() {
  els.formModal.reset();
  els.erroModal.hidden = true;
  els.modal.showModal();
  $("#novoNome").focus();
}

// Fecha o formulário e mostra sucesso só depois que o banco confirma.
function configurarModal() {
  const botao = $('button[type="submit"]', els.formModal);

  els.modal.addEventListener("click", (e) => {
    if (botao.disabled) return;
    if (e.target === els.modal || e.target.closest('[data-action="fechar-modal"]')) els.modal.close();
  });
  els.modal.addEventListener("cancel", (e) => {
    if (botao.disabled) e.preventDefault();
  });

  els.formModal.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (botao.disabled) return;
    botao.disabled = true;
    els.erroModal.hidden = true;
    const nome = els.formModal.elements.nome.value;
    const telefone = els.formModal.elements.telefone.value;

    try {
      gerarLinkWhatsApp(telefone); // valida o telefone (DDI + número)
      const criado = await novoAtendimento(nome, telefone.replace(/\D/g, ""));
      els.modal.close();
      estado.filtro = "todos";
      location.hash = `whatsapp/${criado.id}`;
      toast(`Atendimento #${criado.id} criado para ${criado.cliente}.`);
    } catch (erro) {
      els.erroModal.textContent = erro.message;
      els.erroModal.hidden = false;
    } finally {
      botao.disabled = false;
    }
  });
}
