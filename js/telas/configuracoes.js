/* ==========================================================================
   Tela 5 — Configurações
   Dados da empresa, redes sociais e integrações (WhatsApp, Instagram, IA, n8n).
   ========================================================================== */

import { gerarLinkWhatsApp } from "../whatsapp.js";
import { integracoesDemo } from "../dados-demo.js";
import { $, $$, icone, escapar, toast, lerArmazenado, gravarArmazenado } from "../ui.js";

const CHAVE_INTEGRACOES = "cf-integracoes";
let integracoes = lerArmazenado(CHAVE_INTEGRACOES, integracoesDemo);

export function iniciarConfiguracoes() {
  configurarAbas();
  configurarLinkWhatsApp();
  renderizarIntegracoes();
  $("#listaIntegracoes").addEventListener("click", alternarIntegracao);
}

/* ---------- Abas acessíveis (clique + setas do teclado) ---------- */

function configurarAbas() {
  const abas = $$(".tabs__tab");

  const ativar = (aba) => {
    abas.forEach((a) => {
      const ativa = a === aba;
      a.classList.toggle("is-active", ativa);
      a.setAttribute("aria-selected", String(ativa));
      a.tabIndex = ativa ? 0 : -1;
      $(`#${a.getAttribute("aria-controls")}`).hidden = !ativa;
    });
    aba.focus();
  };

  abas.forEach((aba, i) => {
    aba.addEventListener("click", () => ativar(aba));
    aba.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") ativar(abas[(i + 1) % abas.length]);
      if (e.key === "ArrowLeft") ativar(abas[(i - 1 + abas.length) % abas.length]);
    });
  });
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
      <article class="card integration">
        <div class="integration__head">
          <span class="integration__logo" style="background:${i.cor}">${icone(i.icone)}</span>
          <div>
            <h3 class="card__title">${escapar(i.nome)}</h3>
            <p>${escapar(i.descricao)}</p>
          </div>
        </div>
        <div class="integration__foot">
          <span class="integration__state ${i.conectado ? "is-on" : ""}">${i.conectado ? "Conectado" : "Desconectado"}</span>
          <button type="button" class="btn btn--sm ${i.conectado ? "btn--secondary" : "btn--primary"}" data-integracao="${i.id}">
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
