/* ==========================================================================
   Tela 5 — Configurações
   Dados da empresa (com logo), redes sociais e integrações
   (WhatsApp, Instagram, IA e n8n).
   ========================================================================== */

import { gerarLinkWhatsApp } from "../whatsapp.js";
import { integracoesDemo } from "../dados-demo.js";
import { $, $$, icone, escapar, toast, lerArmazenado, gravarArmazenado, configurarAbas } from "../ui.js";

const CHAVE_INTEGRACOES = "cf-integracoes";
const CHAVE_LOGO = "cf-logo";
const LIMITE_LOGO = 400 * 1024; // 400 KB (fica salvo no localStorage)
let integracoes = lerArmazenado(CHAVE_INTEGRACOES, integracoesDemo);

export function iniciarConfiguracoes() {
  configurarAbas($("#view-configuracoes .settings"));
  configurarLinkWhatsApp();
  configurarLogo();
  renderizarIntegracoes();
  $("#listaIntegracoes").addEventListener("click", alternarIntegracao);

  // Botão "Salvar alterações" do topo envia o formulário da aba visível
  $('[data-action="salvar-configuracoes"]').addEventListener("click", () => {
    const visivel = $$("#view-configuracoes form[data-persistir]").find((f) => !f.hidden);
    if (visivel) visivel.requestSubmit();
    else toast("As integrações já são salvas automaticamente.");
  });
}

/* ---------- Logo da empresa ---------- */

function configurarLogo() {
  const entrada = $("#cfgLogo");
  const nome = $("#cfgNome");

  entrada.addEventListener("change", () => {
    const arquivo = entrada.files[0];
    entrada.value = "";
    if (!arquivo) return;
    if (!arquivo.type.startsWith("image/")) return toast("Selecione um arquivo de imagem.", "erro");
    if (arquivo.size > LIMITE_LOGO) return toast("A imagem deve ter no máximo 400 KB.", "erro");

    const leitor = new FileReader();
    leitor.onload = () => {
      gravarArmazenado(CHAVE_LOGO, leitor.result);
      atualizarLogo();
      toast("Logo atualizada.");
    };
    leitor.readAsDataURL(arquivo);
  });

  $('[data-action="remover-logo"]').addEventListener("click", () => {
    localStorage.removeItem(CHAVE_LOGO);
    atualizarLogo();
    toast("Logo removida.");
  });

  nome.addEventListener("input", () => {
    $("#logoNome").textContent = nome.value || "Sua empresa";
  });
  $("#logoNome").textContent = nome.value;
  atualizarLogo();
}

/* Atualiza a logo no formulário, no menu lateral e na prévia do Instagram */
export function atualizarLogo() {
  const logo = lerArmazenado(CHAVE_LOGO);
  $("#logoPreview img").src = logo || "assets/logo.svg";
  document.dispatchEvent(new CustomEvent("cf:salvo", { detail: CHAVE_LOGO }));
}

/* ---------- Link wa.me gerado com js/whatsapp.js ---------- */

function configurarLinkWhatsApp() {
  const telefone = $("#cfgWhatsapp");
  const mensagem = $("#cfgMensagemLink");
  const saida = $("#linkWhatsappGerado");
  const dica = $("#dicaWhatsapp");
  const copiar = $('[data-action="copiar-link"]');

  const atualizar = () => {
    if (!telefone.value.trim()) {
      saida.textContent = "Informe o WhatsApp para gerar o link";
      dica.textContent = "Usado para gerar o link de contato wa.me.";
      dica.classList.remove("is-error");
      telefone.removeAttribute("aria-invalid");
      copiar.disabled = true;
      return;
    }
    try {
      saida.textContent = gerarLinkWhatsApp(telefone.value, mensagem.value);
      dica.textContent = "Número válido.";
      dica.classList.remove("is-error");
      telefone.removeAttribute("aria-invalid");
      copiar.disabled = false;
    } catch (erro) {
      saida.textContent = "—";
      dica.textContent = erro.message;
      dica.classList.add("is-error");
      telefone.setAttribute("aria-invalid", "true");
      copiar.disabled = true;
    }
  };

  telefone.addEventListener("input", atualizar);
  mensagem.addEventListener("input", atualizar);
  copiar.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(saida.textContent);
      toast("Link copiado para a área de transferência.");
    } catch {
      toast("Não foi possível copiar. Selecione o link manualmente.", "erro");
    }
  });
  atualizar();
}

/* ---------- Integrações ---------- */

function renderizarIntegracoes() {
  $("#listaIntegracoes").innerHTML = integracoes
    .map((i) => `
      <article class="integration">
        <div class="integration__head">
          <span class="integration__logo" style="background:${i.cor}">${icone(i.icone)}</span>
          <div>
            <h3>${escapar(i.nome)}</h3>
            <p>${escapar(i.descricao)}</p>
          </div>
        </div>
        <div class="integration__foot">
          <span class="integration__state ${i.conectado ? "is-on" : ""}">${i.conectado ? "Conectado" : "Desconectado"}</span>
          <button type="button" class="btn btn--sm ${i.conectado ? "btn--outline" : "btn--primary"}" data-integracao="${i.id}">
            ${i.conectado ? "Desconectar" : "Conectar"}
          </button>
        </div>
      </article>`)
    .join("");
}

function alternarIntegracao(e) {
  const botao = e.target.closest("[data-integracao]");
  if (!botao) return;
  integracoes = integracoes.map((i) =>
    i.id === botao.dataset.integracao ? { ...i, conectado: !i.conectado } : i
  );
  gravarArmazenado(CHAVE_INTEGRACOES, integracoes);
  renderizarIntegracoes();
  const atual = integracoes.find((i) => i.id === botao.dataset.integracao);
  toast(`${atual.nome} ${atual.conectado ? "conectado" : "desconectado"} (simulação).`);
}
