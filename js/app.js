/* ==========================================================================
   ConnectFlow — ponto de entrada da interface
   Responsável por: navegação entre as 5 telas (rotas por #hash), menu lateral
   responsivo, ações do topo de cada tela, persistência dos formulários e
   inicialização de cada tela.
   ========================================================================== */

import { $, $$, toast, iniciais, lerArmazenado, gravarArmazenado, lerFormulario, preencherFormulario } from "./ui.js";
import { iniciarDashboard } from "./telas/dashboard.js";
import { iniciarWhatsApp, abrirConversa } from "./telas/whatsapp-tela.js";
import { iniciarAgente } from "./telas/agente.js";
import { iniciarInstagram } from "./telas/instagram.js";
import { iniciarConfiguracoes } from "./telas/configuracoes.js";

/* As 5 telas principais definidas no README do projeto */
const TELAS = {
  dashboard: { titulo: "Dashboard", subtitulo: "Visão geral do seu atendimento e marketing" },
  whatsapp: { titulo: "WhatsApp", subtitulo: "Atendimentos e conversas em tempo real" },
  agente: { titulo: "Agente de IA", subtitulo: "Configure o comportamento do seu assistente virtual" },
  instagram: { titulo: "Instagram Studio", subtitulo: "Crie, edite e programe suas publicações" },
  configuracoes: { titulo: "Configurações", subtitulo: "Gerencie sua empresa, redes sociais e integrações" }
};

/* ---------- Menu lateral (gaveta em telas menores) ---------- */

const sidebar = $("#sidebar");
const backdrop = $(".backdrop");
const botaoMenu = $('[data-action="abrir-menu"]');

function abrirMenu() {
  sidebar.classList.add("is-open");
  backdrop.hidden = false;
  botaoMenu.setAttribute("aria-expanded", "true");
  $(".nav-link.is-active", sidebar)?.focus();
}

function fecharMenu() {
  if (!sidebar.classList.contains("is-open")) return;
  sidebar.classList.remove("is-open");
  backdrop.hidden = true;
  botaoMenu.setAttribute("aria-expanded", "false");
}

botaoMenu.addEventListener("click", abrirMenu);
$$('[data-action="fechar-menu"]').forEach((el) => el.addEventListener("click", fecharMenu));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    fecharMenu();
    $("#chatLayout").classList.remove("info-aberta");
  }
});

/* ---------- Roteamento por hash: #tela ou #tela/parametro ---------- */

function navegar() {
  const [nome, parametro] = location.hash.replace(/^#/, "").split("/");
  const tela = TELAS[nome] ? nome : "dashboard";
  const anterior = document.body.dataset.tela;

  $$(".view").forEach((v) => { v.hidden = v.dataset.view !== tela; });
  $$("[data-acoes]").forEach((g) => { g.hidden = g.dataset.acoes !== tela; });
  $$(".nav-link").forEach((link) => {
    const ativo = link.dataset.view === tela;
    link.classList.toggle("is-active", ativo);
    if (ativo) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });

  $("#tituloPagina").textContent = TELAS[tela].titulo;
  $("#subtituloPagina").textContent = TELAS[tela].subtitulo;
  document.title = `${TELAS[tela].titulo} · ConnectFlow`;
  document.body.dataset.tela = tela;

  if (tela === "whatsapp") abrirConversa(parametro);
  if (anterior !== tela) window.scrollTo({ top: 0 });
  fecharMenu();
}

/* ---------- Cartão da empresa no menu lateral ---------- */

function atualizarCartaoEmpresa() {
  const nome = lerArmazenado("cf-empresa")?.nome || "Empresa Exemplo";
  const logo = lerArmazenado("cf-logo");
  $("#empresaNomeMenu").textContent = nome;
  const avatar = $("#empresaAvatar");
  if (logo) {
    avatar.innerHTML = "";
    const img = document.createElement("img");
    img.src = logo;
    img.alt = "";
    avatar.append(img);
  } else {
    avatar.textContent = iniciais(nome).slice(0, 1);
  }
}

/* ---------- Formulários com persistência local (data-persistir) ---------- */

function configurarFormulariosPersistentes() {
  $$("form[data-persistir]").forEach((form) => {
    const chave = form.dataset.persistir;
    preencherFormulario(form, lerArmazenado(chave));

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const campos = [...form.elements];
      campos.forEach((c) => c.removeAttribute?.("aria-invalid"));
      const invalidos = campos.filter((c) => c.willValidate && !c.checkValidity());
      if (invalidos.length) {
        invalidos.forEach((c) => c.setAttribute("aria-invalid", "true"));
        // Se o campo estiver em uma aba escondida, mostra essa aba antes de focar
        const painel = invalidos[0].closest('[role="tabpanel"]');
        if (painel?.hidden) document.querySelector(`[aria-controls="${painel.id}"]`)?.click();
        invalidos[0].focus();
        toast("Verifique os campos destacados.", "erro");
        return;
      }
      gravarArmazenado(chave, lerFormulario(form));
      document.dispatchEvent(new CustomEvent("cf:salvo", { detail: chave }));
      toast("Alterações salvas.");
    });
  });

  document.addEventListener("cf:salvo", (e) => {
    if (["cf-empresa", "cf-logo"].includes(e.detail)) atualizarCartaoEmpresa();
  });
}

/* ---------- Inicialização ---------- */

configurarFormulariosPersistentes(); // antes das telas: elas leem os valores salvos
atualizarCartaoEmpresa();
iniciarDashboard();
iniciarWhatsApp();
iniciarAgente();
iniciarInstagram();
iniciarConfiguracoes();

window.addEventListener("hashchange", navegar);
navegar();
