/* ==========================================================================
   Tela 4 — Instagram Studio
   Criação, edição e agendamento de publicações, com prévia ao vivo.
   A publicação real será feita pela integração com a API do Instagram.
   ========================================================================== */

import { postsDemo } from "../dados-demo.js";
import { $, icone, escapar, formatarData, toast, lerArmazenado, iniciais } from "../ui.js";

const LIMITE_LEGENDA = 2200;
const FILTROS = [
  { valor: "agendado", rotulo: "Programados" },
  { valor: "publicado", rotulo: "Publicados" },
  { valor: "rascunho", rotulo: "Rascunhos" }
];

let posts = structuredClone(postsDemo);
let filtro = "agendado";
let selecionadoId = null;   // post exibido na prévia quando o editor está fechado
let editandoId = null;      // post em edição (null = novo post)
let editorAberto = false;
let imagemAtual = "";
let fundoAtual = 1;

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
  $('[data-action="fechar-editor"]').addEventListener("click", fecharEditor);
  $('[data-action="novo-post"]').addEventListener("click", () => abrirEditor());

  els.arquivo.addEventListener("change", () => carregarImagem(els.arquivo.files[0]));
  configurarArrastar();

  $("#filtrosPosts").addEventListener("click", (e) => {
    const pill = e.target.closest("[data-filtro]");
    if (!pill) return;
    filtro = pill.dataset.filtro;
    selecionadoId = null;
    renderizarLista();
    atualizarPreview();
  });
  $("#listaPosts").addEventListener("click", tratarCliqueLista);

  document.addEventListener("cf:salvo", (e) => {
    if (["cf-redes", "cf-empresa", "cf-logo"].includes(e.detail)) atualizarPreview();
  });

  renderizarLista();
  atualizarPreview();
}

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const postsDoFiltro = () => posts
  .filter((p) => p.status === filtro)
  .sort((a, b) => `${a.data}${a.hora}`.localeCompare(`${b.data}${b.hora}`));

/* ---------- Prévia ---------- */

function usuarioInstagram() {
  const redes = lerArmazenado("cf-redes") ?? {};
  const empresa = lerArmazenado("cf-empresa") ?? {};
  const usuario = (redes.instagram || "").replace(/^@/, "").trim();
  if (usuario) return usuario;
  return (empresa.nome || "Empresa Exemplo")
    .normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9._]/g, "");
}

/* Dados mostrados na prévia: o editor (se aberto) ou o post selecionado */
function dadosDaPrevia() {
  if (editorAberto) {
    return {
      formato: els.form.elements.formato.value,
      legenda: els.legenda.value,
      hashtags: els.hashtags.value,
      data: els.data.value,
      hora: els.hora.value,
      imagem: imagemAtual,
      fundo: fundoAtual
    };
  }
  return posts.find((p) => p.id === selecionadoId) ?? postsDoFiltro()[0] ?? null;
}

function titulo(legenda) {
  const limpo = legenda.replace(/[^\p{L}\p{N}\s!?.,]/gu, "").trim();
  const frase = limpo.split(/[.!?\n]/)[0].trim();
  return frase.length > 32 ? `${frase.slice(0, 30).trim()}…` : frase;
}

function atualizarPreview() {
  const dados = dadosDaPrevia();
  const usuario = usuarioInstagram();
  const logo = lerArmazenado("cf-logo");

  $("#previewUsuario").textContent = usuario;
  $("#previewUsuario2").textContent = usuario;
  $("#previewAvatar").innerHTML = logo ? `<img src="${logo}" alt="">` : escapar(iniciais(usuario.replace(/[._]/g, " ")).slice(0, 2));

  const legenda = dados?.legenda ?? "";
  els.preview.dataset.formato = dados?.formato ?? "feed";
  $("#previewLegenda").textContent = legenda || "A legenda da publicação aparece aqui.";
  $("#previewTags").textContent = dados?.hashtags ?? "";
  $("#previewTitulo").textContent = dados ? (titulo(legenda) || "Sua imagem aparecerá aqui") : "Nenhum post selecionado";

  els.midia.dataset.fundo = dados?.fundo ?? 1;
  els.midia.style.backgroundImage = dados?.imagem ? `url("${dados.imagem}")` : "";
  els.midia.classList.toggle("has-image", Boolean(dados?.imagem));

  $("#previewAgendamento").innerHTML = dados?.data
    ? `${icone("i-calendar")}${dados.status === "publicado" ? "Publicado em" : "Programado para"} ${formatarData(dados.data)} às ${escapar(dados.hora || "--:--")}`
    : "";

  // Contador e estado da área de upload do editor
  const contador = $("#contadorLegenda");
  contador.textContent = `${els.legenda.value.length} / ${LIMITE_LEGENDA}`;
  contador.classList.toggle("is-warning", els.legenda.value.length > LIMITE_LEGENDA * 0.9);
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

/* ---------- Editor ---------- */

function abrirEditor(post = null) {
  editorAberto = true;
  editandoId = post?.id ?? null;
  imagemAtual = post?.imagem ?? "";
  fundoAtual = post?.fundo ?? (posts.length % 4) + 1;
  els.form.reset();
  els.erro.hidden = true;
  if (post) {
    els.form.elements.formato.value = post.formato;
    els.legenda.value = post.legenda;
    els.hashtags.value = post.hashtags;
    els.data.value = post.data;
    els.hora.value = post.hora || "18:00";
  }
  $("#tituloEditor").textContent = post ? "Editar post" : "Novo post";
  els.form.hidden = false;
  atualizarPreview();
  els.form.scrollIntoView({ behavior: "smooth", block: "start" });
  els.legenda.focus({ preventScroll: true });
}

function fecharEditor() {
  editorAberto = false;
  editandoId = null;
  imagemAtual = "";
  els.form.hidden = true;
  atualizarPreview();
}

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
    fundo: fundoAtual,
    status
  };

  let id = editandoId;
  if (id) {
    posts = posts.map((p) => (p.id === id ? { ...p, ...dados } : p));
  } else {
    id = Date.now();
    posts = [{ id, ...dados }, ...posts];
  }

  toast(status === "agendado"
    ? `Post programado para ${formatarData(dados.data)} às ${dados.hora}.`
    : "Rascunho salvo.");

  filtro = status;
  selecionadoId = id;
  fecharEditor();
  renderizarLista();
  atualizarPreview();
}

/* ---------- Lista ---------- */

function tratarCliqueLista(e) {
  const item = e.target.closest("[data-id]");
  if (!item) return;
  const id = Number(item.dataset.id);
  const acao = e.target.closest("[data-acao]")?.dataset.acao;

  if (acao === "editar") {
    abrirEditor(posts.find((p) => p.id === id));
  } else if (acao === "excluir") {
    if (!confirm("Excluir esta publicação?")) return;
    posts = posts.filter((p) => p.id !== id);
    if (editandoId === id) fecharEditor();
    if (selecionadoId === id) selecionadoId = null;
    renderizarLista();
    atualizarPreview();
    toast("Publicação excluída.");
  } else if (!editorAberto) {
    selecionadoId = id;
    renderizarLista();
    atualizarPreview();
  }
}

function renderizarLista() {
  $("#filtrosPosts").innerHTML = FILTROS.map(({ valor, rotulo }) => {
    const ativo = valor === filtro;
    const qtd = posts.filter((p) => p.status === valor).length;
    return `<button type="button" class="pill ${ativo ? "is-active" : ""}" data-filtro="${valor}" role="tab" aria-selected="${ativo}">${rotulo} (${qtd})</button>`;
  }).join("");

  const itens = postsDoFiltro();
  if (!itens.length) {
    $("#listaPosts").innerHTML = `<li class="empty-state">${icone("i-calendar")}
      <strong>Nada por aqui</strong><span>Clique em "Novo Post" para criar uma publicação.</span></li>`;
    return;
  }

  const exibido = dadosDaPrevia();
  $("#listaPosts").innerHTML = itens
    .map((p) => `
      <li class="post-item ${!editorAberto && exibido?.id === p.id ? "is-selected" : ""}" data-id="${p.id}">
        <span class="post-item__thumb" data-fundo="${p.fundo ?? 1}" ${p.imagem ? `style="background-image:url('${p.imagem}')"` : ""}>
          ${p.imagem ? "" : icone(p.formato === "story" ? "i-instagram" : "i-image")}
        </span>
        <div class="post-item__body">
          <strong>${escapar(p.legenda || "(sem legenda)")}</strong>
          <div class="post-item__meta">
            ${p.data ? `${icone("i-calendar")}<span>${formatarData(p.data)} às ${escapar(p.hora)}</span>` : "<span>Sem data</span>"}
            <span>· ${p.formato === "story" ? "Story" : "Feed"}</span>
          </div>
        </div>
        <div class="post-item__actions">
          ${p.status !== "publicado" ? `<button class="icon-btn" type="button" data-acao="editar" aria-label="Editar publicação">${icone("i-edit")}</button>` : ""}
          <button class="icon-btn icon-btn--danger" type="button" data-acao="excluir" aria-label="Excluir publicação">${icone("i-trash")}</button>
        </div>
      </li>`)
    .join("");
}
