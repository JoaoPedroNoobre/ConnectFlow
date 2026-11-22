
import {
  STATUS,
  RESPONSAVEIS
} from "./atendimentos.js";

import { ORIGENS } from "./origem.js";

// Calcula todas as métricas do Dashboard
export function calcularMetricas(atendimentos) {

  // Verifica se os dados são uma lista
  if (!Array.isArray(atendimentos)) {
    throw new Error("Informe uma lista de atendimentos.");
  }

  // Conta os atendimentos resolvidos pela IA
  const resolvidosIA = atendimentos.filter(
    (a) =>
      a.status === STATUS.RESOLVIDO &&
      a.resolvidoPor === RESPONSAVEIS.IA
  ).length;

  // Conta os atendimentos resolvidos por humanos
  const resolvidosHumanos = atendimentos.filter(
    (a) =>
      a.status === STATUS.RESOLVIDO &&
      a.resolvidoPor === RESPONSAVEIS.HUMANO
  ).length;

  // Soma as resoluções com responsável identificado
  const totalIdentificado = resolvidosIA + resolvidosHumanos;

  return {
    // Total de clientes atendidos
    total: atendimentos.length,

    // Atendimentos ativos
    emAtendimento: atendimentos.filter(
      (a) => a.status === STATUS.EM_ATENDIMENTO
    ).length,

    // Clientes aguardando um funcionário
    aguardandoHumano: atendimentos.filter(
      (a) => a.status === STATUS.AGUARDANDO_HUMANO
    ).length,

    // Atendimentos concluídos
    resolvidos: atendimentos.filter(
      (a) => a.status === STATUS.RESOLVIDO
    ).length,

    // Atendimentos assumidos por humanos
    assumidos: atendimentos.filter(
      (a) => a.status === STATUS.ASSUMIDO
    ).length,

    // Novas métricas
    resolvidosIA,
    resolvidosHumanos,

    // Clientes vindos do Instagram
    origemInstagram: atendimentos.filter(
      (a) => a.origem === ORIGENS.INSTAGRAM
    ).length,

    // Porcentagem de resoluções feitas pela IA
    taxaResolucaoIA: totalIdentificado === 0
      ? 0
      : Math.round((resolvidosIA / totalIdentificado) * 100)
  };
}
