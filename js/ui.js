/* ==========================================================================
   Utilitários de interface compartilhados pelas telas
   ========================================================================== */

import { STATUS } from "./atendimentos.js";

const SPRITE = "assets/icons.svg";

/* Rótulos amigáveis para os status de js/atendimentos.js */
export const ROTULO_STATUS = Object.freeze({
  [STATUS.EM_ATENDIMENTO]: "IA atendendo",
  [STATUS.AGUARDANDO_HUMANO]: "Aguardando humano",
  [STATUS.ASSUMIDO]: "Assumido",
  [STATUS.RESOLVIDO]: "Resolvido"
});

/* Atalho para seletores */
export const $ = (seletor, raiz = document) => raiz.querySelector(seletor);
export const $$ = (seletor, raiz = document) => [...raiz.querySelectorAll(seletor)];

/* Markup de um ícone do sprite */
export function icone(nome, classe = "") {
  return `<svg class="icon ${classe}" aria-hidden="true"><use href="${SPRITE}#${nome}"/></svg>`;
}

/* Evita injeção de HTML ao inserir textos digitados pelo usuário */
export function escapar(texto) {
  return String(texto ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/* Rótulos curtos usados nos filtros da caixa de entrada */
export const ROTULO_FILTRO = Object.freeze({
  [STATUS.EM_ATENDIMENTO]: "IA",
  [STATUS.AGUARDANDO_HUMANO]: "Aguardando",
  [STATUS.ASSUMIDO]: "Humanos",
  [STATUS.RESOLVIDO]: "Resolvidos"
});

/* Cor de avatar estável a partir do nome (1 a 5, ver .avatar[data-cor]) */
export function corAvatar(nome) {
  let soma = 0;
  for (const letra of String(nome)) soma += letra.charCodeAt(0);
  return (soma % 5) + 1;
}

/* Abas acessíveis (clique + setas do teclado) dentro de um contêiner */
export function configurarAbas(container) {
  const abas = $$('[role="tab"]', container);
  const ativar = (aba, focar = true) => {
    abas.forEach((a) => {
      const ativa = a === aba;
      a.classList.toggle("is-active", ativa);
      a.setAttribute("aria-selected", String(ativa));
      a.tabIndex = ativa ? 0 : -1;
      document.getElementById(a.getAttribute("aria-controls")).hidden = !ativa;
    });
    if (focar) aba.focus();
  };
  abas.forEach((aba, i) => {
    aba.addEventListener("click", () => ativar(aba));
    aba.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") ativar(abas[(i + 1) % abas.length]);
      if (e.key === "ArrowLeft") ativar(abas[(i - 1 + abas.length) % abas.length]);
    });
  });
  return (id) => ativar(abas.find((a) => a.id === id), false);
}

export function badgeStatus(status) {
  return `<span class="badge badge--${status}">${ROTULO_STATUS[status] ?? status}</span>`;
}

/* "Maria Oliveira" -> "MO" */
export function iniciais(nome) {
  const partes = String(nome).trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "?";
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes.at(-1)[0] : "";
  return (primeira + ultima).toUpperCase();
}

export const formatarPreco = (valor) =>
  Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function horaAtual() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/* "2026-11-25" -> "25/11/2026" */
export function formatarData(iso) {
  if (!iso) return "";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

/* "+55 (83) 99999-0001" a partir de "5583999990001" */
export function formatarTelefone(numero) {
  const d = String(numero).replace(/\D/g, "");
  const m = d.match(/^(\d{2})(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `+${m[1]} (${m[2]}) ${m[3]}-${m[4]}` : d;
}

/* Notificação temporária no canto da tela */
export function toast(mensagem, tipo = "sucesso") {
  const regiao = $("#toasts");
  const el = document.createElement("div");
  el.className = `toast toast--${tipo}`;
  el.innerHTML = `${icone(tipo === "erro" ? "i-info" : "i-check-circle")}<span>${escapar(mensagem)}</span>`;
  regiao.append(el);
  setTimeout(() => {
    el.classList.add("is-leaving");
    el.addEventListener("animationend", () => el.remove(), { once: true });
  }, 3200);
}

/* ---------- Persistência local (localStorage) para formulários ---------- */

export function lerArmazenado(chave, padrao = null) {
  try {
    const valor = localStorage.getItem(chave);
    return valor ? JSON.parse(valor) : padrao;
  } catch {
    return padrao;
  }
}

export function gravarArmazenado(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* Armazenamento indisponível (ex.: modo privado): ignora silenciosamente */
  }
}

/* Converte um formulário em objeto (checkbox vira true/false) */
export function lerFormulario(form) {
  const dados = {};
  for (const campo of form.elements) {
    if (!campo.name || campo.type === "file") continue;
    if (campo.type === "checkbox") dados[campo.name] = campo.checked;
    else if (campo.type === "radio") { if (campo.checked) dados[campo.name] = campo.value; }
    else dados[campo.name] = campo.value;
  }
  return dados;
}

export function preencherFormulario(form, dados) {
  if (!dados) return;
  for (const campo of form.elements) {
    if (!campo.name || !(campo.name in dados)) continue;
    if (campo.type === "checkbox") campo.checked = Boolean(dados[campo.name]);
    else if (campo.type === "radio") campo.checked = campo.value === dados[campo.name];
    else campo.value = dados[campo.name];
  }
}
