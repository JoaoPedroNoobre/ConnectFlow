
import {
  criarAtendimento,
  alterarStatusAtendimento,
  finalizarAtendimento,
  STATUS,
  RESPONSAVEIS
} from "./js/atendimentos.js";

import { definirIAAtiva } from "./js/controle-ia.js";

import {
  registrarOrigem,
  ORIGENS
} from "./js/origem.js";

import { calcularMetricas } from "./js/dashboard.js";

import { gerarLinkWhatsApp } from "./js/whatsapp.js";

// Gera um link de atendimento
const link = gerarLinkWhatsApp(
  "5583999999999",
  "Olá, vim do Instagram!"
);

console.log("Link WhatsApp:", link);

// Maria veio do Instagram e foi atendida pela IA
let maria = criarAtendimento("001", "Maria");

maria = registrarOrigem(maria, ORIGENS.INSTAGRAM);

maria = finalizarAtendimento(maria, RESPONSAVEIS.IA);

// João precisou de atendimento humano
let joao = criarAtendimento("002", "João");

joao = definirIAAtiva(joao, false);

joao = alterarStatusAtendimento(
  joao,
  STATUS.ASSUMIDO
);

// Ana veio do Instagram e ainda está em atendimento
let ana = criarAtendimento("003", "Ana");

ana = registrarOrigem(ana, ORIGENS.INSTAGRAM);

// Reúne os atendimentos simulados
const atendimentos = [maria, joao, ana];

// Exibe os atendimentos
console.log("Atendimentos:", atendimentos);

// Calcula e exibe as métricas
console.log("Dashboard:", calcularMetricas(atendimentos));
