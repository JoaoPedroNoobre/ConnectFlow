/* ==========================================================================
   Tela 4 — Instagram Studio
   Criação, edição e agendamento de publicações, com pré-visualização ao vivo.
   A publicação real será feita pela integração com a API do Instagram.
   ========================================================================== */

import { postsDemo } from "../dados-demo.js";
import { $, $$, icone, escapar, formatarData, toast, lerArmazenado, iniciais } from "../ui.js";

const LIMITE_LEGENDA = 2200;
const ROTULOS = { agendado: "Agendado", rascunho: "Rascunho", publicado: "Publicado" };

let posts = structuredClone(postsDemo);
let filtro = "agendado";
let editandoId = null;
let imagemAtual = "";

const els = {};

export function iniciarInstagram() {
  els.form = $("#formPost");
  els.legenda = $("#postLegenda");
  els.hashtags = $("#postHashtags");
  els.data = $("#postData");
  els.hora = $("#postHora");
  els.arquivo = $("#postImagem");
  els.dropzone = $("#dropzone");
  els.erro = $("#erroPost");
  els.preview = $("#previewPost");
  els.midia = $("#previewMidia");

  els.data.min = hojeISO();

  els.form.addEventListener("input", atualizarPreview);
  els.form.addEventListener("change", atualizarPreview);
  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    salvar("agendado");
  });
  $('[data-action="salvar-rascunho"]').addEventListener("click", () => salvar("rascunho"));
  $('[data-action="limpar-post"]').addEventListener("click", limparEditor);

  els.arquivo.addEventListener("change", () => carregarImagem(els.arquivo.files[0]));
  configurarArrastar();

  $("#filtrosPosts").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-filtro]");
    if (!chip) return;
    filtro = chip.dataset.filtro;
    $$("#filtrosPosts .chip").forEach((c) => {
      c.classList.toggle("is-active", c === chip);
      c.setAttribute("aria-selected", String(c === chip));
    });
    renderizarLista();
  });
  $("#listaPosts").addEventListener("click", tratarAcaoLista);

  document.addEventListener("cf:salvo", (e) => {
    if (e.detail === "cf-redes" || e.detail === "cf-empresa") atualizarPreview();
  });

  atualizarPreview();
  renderizarLista();
}

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ---------- Pré-visualização ---------- */

function usuarioInstagram() {
  const redes = lerArmazenado("cf-redes") ?? {};
  const empresa = lerArmazenado("cf-empresa") ?? {};
  const usuario = (redes.instagram || "").replace(/^@/, "").trim();
  if (usuario) return usuario;
  return normalizarUsuario(empresa.nome || "minhaempresa");
}

function normalizarUsuario(nome) {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9._]/g, "");
}

function atualizarPreview() {
  const formato = els.form.elements.formato.value;
  const legenda = els.legenda.value;
  const usuario = usuarioInstagram();

  els.preview.dataset.formato = formato;
  $("#previewUsuario").textContent = usuario;
  $("#previewUsuario2").textContent = usuario;
  $("#previewAvatar").textContent = iniciais(usuario.replace(/[._]/g, " ")).slice(0, 2);
  $("#previewLegenda").textContent = legenda || "A legenda da publicação aparece aqui.";
  $("#previewTags").textContent = els.hashtags.value;

  const contador = $("#contadorLegenda");
  contador.textContent = `${legenda.length} / ${LIMITE_LEGENDA}`;
  contador.classList.toggle("is-warning", legenda.length > LIMITE_LEGENDA * 0.9);

  $("#previewAgendamento").innerHTML = els.data.value
    ? `${icone("i-calendar")}Agendado para ${formatarData(els.data.value)} às ${escapar(els.hora.value || "--:--")}`
    : "";

  els.midia.style.backgroundImage = imagemAtual ? `url("${imagemAtual}")` : "";
  els.midia.classList.toggle("has-image", Boolean(imagemAtual));
  els.dropzone.classList.toggle("has-file", Boolean(imagemAtual));
  els.dropzone.querySelector("strong").textContent = imagemAtual ? "Imagem selecionada — clique para trocar" : "Clique ou arraste uma imagem";
}

/* ---------- Imagem (fica apenas no navegador) ---------- */

function carregarImagem(arquivo) {
  if (!arquivo) return;
  if (!arquivo.type.startsWith("image/")) {
    toast("Selecione um arquivo de imagem.", "erro");
    return;
  }
  const leitor = new FileReader();
  leitor.onload = () => {
    imagemAtual = leitor.result;
    atualizarPreview();
  };
  leitor.readAsDataURL(arquivo);
}

function configurarArrastar() {
  ["dragenter", "dragover"].forEach((ev) =>
    els.dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      els.dropzone.classList.add("is-dragover");
    })
  );
  ["dragleave", "drop"].forEach((ev) =>
    els.dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      els.dropzone.classList.remove("is-dragover");
    })
  );
  els.dropzone.addEventListener("drop", (e) => carregarImagem(e.dataTransfer.files[0]));
}

/* ---------- Salvar / editar ---------- */

function mostrarErro(mensagem, campo) {
  els.erro.textContent = mensagem;
  els.erro.hidden = false;
  campo?.setAttribute("aria-invalid", "true");
  campo?.focus();
}

function salvar(status) {
  els.erro.hidden = true;
  [els.legenda, els.data, els.hora].forEach((c) => c.removeAttribute("aria-invalid"));

  if (!els.legenda.value.trim() && !imagemAtual) {
    return mostrarErro("Adicione uma imagem ou escreva uma legenda.", els.legenda);
  }

  if (status === "agendado") {
    if (!els.data.value) return mostrarErro("Escolha a data da publicação.", els.data);
    if (!els.hora.value) return mostrarErro("Escolha o horário da publicação.", els.hora);
    if (new Date(`${els.data.value}T${els.hora.value}`) <= new Date()) {
      return mostrarErro("A data e o horário devem estar no futuro.", els.data);
    }
  }

  const dados = {
    formato: els.form.elements.formato.value,
    legenda: els.legenda.value.trim(),
    hashtags: els.hashtags.value.trim(),
    data: els.data.value,
    hora: els.hora.value,
    imagem: imagemAtual,
    status
  };

  if (editandoId) {
    posts = posts.map((p) => (p.id === editandoId ? { ...p, ...dados } : p));
  } else {
    posts = [{ id: Date.now(), ...dados }, ...posts];
  }

  toast(status === "agendado"
    ? `Publicação agendada para ${formatarData(dados.data)} às ${dados.hora}.`
    : "Rascunho salvo.");

  filtro = status;
  $$("#filtrosPosts .chip").forEach((c) => {
    const ativo = c.dataset.filtro === filtro;
    c.classList.toggle("is-active", ativo);
    c.setAttribute("aria-selected", String(ativo));
  });
  limparEditor();
  renderizarLista();
}

function limparEditor() {
  editandoId = null;
  imagemAtual = "";
  els.form.reset();
  els.erro.hidden = true;
  $("#tituloEditor").textContent = "Nova publicação";
  $("#btnCancelarEdicao").hidden = true;
  atualizarPreview();
}

function editar(id) {
  const post = posts.find((p) => p.id === id);
  if (!post) return;
  editandoId = id;
  imagemAtual = post.imagem;
  els.form.elements.formato.value = post.formato;
  els.legenda.value = post.legenda;
  els.hashtags.value = post.hashtags;
  els.data.value = post.data;
  els.hora.value = post.hora || "18:00";
  $("#tituloEditor").textContent = "Editar publicação";
  $("#btnCancelarEdicao").hidden = false;
  atualizarPreview();
  els.form.scrollIntoView({ behavior: "smooth", block: "start" });
  els.legenda.focus({ preventScroll: true });
}

function tratarAcaoLista(e) {
  const botao = e.target.closest("[data-acao]");
  if (!botao) return;
  const id = Number(botao.dataset.id);
  if (botao.dataset.acao === "editar") editar(id);
  if (botao.dataset.acao === "excluir") {
    if (!confirm("Excluir esta publicação?")) return;
    posts = posts.filter((p) => p.id !== id);
    if (editandoId === id) limparEditor();
    renderizarLista();
    toast("Publicação excluída.");
  }
}

/* ---------- Lista ---------- */

function renderizarLista() {
  const itens = posts
    .filter((p) => p.status === filtro)
    .sort((a, b) => `${a.data}${a.hora}`.localeCompare(`${b.data}${b.hora}`));

  if (!itens.length) {
    $("#listaPosts").innerHTML = `<li class="empty-state">${icone("i-calendar")}
      <strong>Nada por aqui</strong><span>Nenhuma publicação com o status "${ROTULOS[filtro]}".</span></li>`;
    return;
  }

  $("#listaPosts").innerHTML = itens
    .map((p) => `
      <li class="post-item">
        <span class="post-item__thumb" ${p.imagem ? `style="background-image:url('${p.imagem}')"` : ""}>
          ${p.imagem ? "" : icone(p.formato === "story" ? "i-instagram" : "i-image")}
        </span>
        <div class="post-item__body">
          <p><strong>${escapar(p.legenda || "(sem legenda)")}</strong></p>
          <div class="post-item__meta">
            <span class="badge badge--${p.status}">${ROTULOS[p.status]}</span>
            <span>${p.formato === "story" ? "Story" : "Feed"}</span>
            ${p.data ? `<span>· ${formatarData(p.data)} às ${escapar(p.hora)}</span>` : ""}
          </div>
        </div>
        <div class="post-item__actions">
          ${p.status !== "publicado" ? `<button class="icon-btn" type="button" data-acao="editar" data-id="${p.id}" aria-label="Editar publicação">${icone("i-edit")}</button>` : ""}
          <button class="icon-btn" type="button" data-acao="excluir" data-id="${p.id}" aria-label="Excluir publicação">${icone("i-trash")}</button>
        </div>
      </li>`)
    .join("");
}
