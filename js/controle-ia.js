
import { STATUS } from "./atendimentos.js";

// Liga ou desliga a IA de um atendimento
export function definirIAAtiva(atendimento, ativa) {

  // Verifica se o atendimento é um objeto válido
  if (
    !atendimento ||
    typeof atendimento !== "object" ||
    Array.isArray(atendimento)
  ) {
    throw new Error("Atendimento inválido.");
  }

  // Verifica se o valor informado é booleano
  if (typeof ativa !== "boolean") {
    throw new Error("Informe true ou false para a IA.");
  }

  // Impede reativar a IA em conversas não disponíveis
  if (ativa && atendimento.status !== STATUS.EM_ATENDIMENTO) {
    throw new Error(
      "A IA só pode ser retomada em atendimento ativo."
    );
  }

  // Retorna uma cópia com a IA ligada ou desligada
  return {
    ...atendimento,
    iaAtiva: ativa
  };
}
