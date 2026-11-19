
import { STATUS } from "./atendimentos.js";

// Calcula as métricas dos atendimentos
export function calcularMetricas(atendimentos) {

  // Verifica se recebemos uma lista
  if (!Array.isArray(atendimentos)) {
    throw new Error("Informe uma lista de atendimentos.");
  }

  return {
    total: atendimentos.length,

    emAtendimento: atendimentos.filter(
      (a) => a.status === STATUS.EM_ATENDIMENTO
    ).length,

    aguardandoHumano: atendimentos.filter(
      (a) => a.status === STATUS.AGUARDANDO_HUMANO
    ).length,

    resolvidos: atendimentos.filter(
      (a) => a.status === STATUS.RESOLVIDO
    ).length,

// Conta quantos atendimentos estão assumidos por humanos

    assumidos: atendimentos.filter(
      (a) => a.status === STATUS.ASSUMIDO
    ).length
  };
}
