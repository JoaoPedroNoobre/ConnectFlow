
/* Origens possíveis dos clientes */
export const ORIGENS = Object.freeze({
  INSTAGRAM: "instagram",
  DIRETO: "direto"
});

/* Registra a origem de um atendimento */
export function registrarOrigem(atendimento, origem) {

  // Verifica se o atendimento é válido
  if (
    !atendimento ||
    typeof atendimento !== "object" ||
    Array.isArray(atendimento)
  ) {
    throw new Error("Atendimento inválido.");
  }

  // Verifica se a origem informada existe
  if (!Object.values(ORIGENS).includes(origem)) {
    throw new Error("Origem inválida.");
  }

  // Retorna uma cópia com a origem do cliente
  return {
    ...atendimento,
    origem: origem
  };
}
