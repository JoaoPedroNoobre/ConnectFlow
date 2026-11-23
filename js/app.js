/* ==========================================================================
   ConnectFlow — ponto de entrada da interface
   Responsável por: navegação entre as 5 telas (rotas por #hash), menu lateral
   responsivo, persistência dos formulários de configuração e inicialização
   de cada tela.
   ========================================================================== */

import { $, $$, toast, iniciais, lerArmazenado, gravarArmazenado, lerFormulario, preencherFormulario } from "./ui.js";
import { iniciarDashboard } from "./telas/dashboard.js";
import { iniciarWhatsApp, abrirConversa } from "./telas/whatsapp-tela.js";
import { iniciarAgente } from "./telas/agente.js";
import { iniciarInstagram } from "./telas/instagram.js";
import { iniciarConfiguracoes } from "./telas/configuracoes.js";

/* As 5 telas principais definidas no README do projeto */
const TELAS = {
  dashboard: { titulo: "Dashboard", subtitulo: "Métricas de atendimentos, clientes, conversões e desempenho da IA" },
  whatsapp: { titulo: "WhatsApp Integrado", subtitulo: "Conversas atendidas pela IA, com intervenção humana quando necessário" },
  agente: { titulo: "Agente de IA", subtitulo: "Configure o assistente virtual que atende seus clientes" },
  instagram: { titulo: "Instagram Studio", subtitulo: "Crie, edite e agende publicações" },
  configuracoes: { titulo: "Configurações", subtitulo: "Dados da empresa, redes sociais e integrações" }
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

/* ---------- Formulários com persistência local (data-persistir) ---------- */

function atualizarCabecalhoEmpresa() {
  const nome = lerArmazenado("cf-empresa")?.nome || "Minha Empresa";
  $("#empresaNomeTopo").textContent = nome;
  $("#empresaAvatar").textContent = iniciais(nome);
}

function configurarFormulariosPersistentes() {
  $$("form[data-persistir]").forEach((form) => {
    const chave = form.dataset.persistir;
    preencherFormulario(form, lerArmazenado(chave));

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const invalidos = [...form.elements].filter((c) => c.willValidate && !c.checkValidity());
      [...form.elements].forEach((c) => c.removeAttribute?.("aria-invalid"));
      if (invalidos.length) {
        invalidos.forEach((c) => c.setAttribute("aria-invalid", "true"));
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
    if (e.detail === "cf-empresa") atualizarCabecalhoEmpresa();
  });
}

/* ---------- Inicialização ---------- */

configurarFormulariosPersistentes(); // antes das telas: elas leem os valores salvos
atualizarCabecalhoEmpresa();
iniciarDashboard();
iniciarWhatsApp();
iniciarAgente();
iniciarInstagram();
iniciarConfiguracoes();

window.addEventListener("hashchange", navegar);
navegar();
