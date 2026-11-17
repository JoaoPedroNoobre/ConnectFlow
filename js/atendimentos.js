
/* Estados possíveis de um atendimento */

export const STATUS = Object.freeze({
  EM_ATENDIMENTO: "em_atendimento",
  AGUARDANDO_HUMANO: "aguardando_humano",
  RESOLVIDO: "resolvido",
  ASSUMIDO: "assumido"
});

/* Cria um novo atendimento */
export function criarAtendimento(id, nomeCliente) {
  if (
    typeof id !== "string" ||
    !id.trim() ||
    typeof nomeCliente !== "string" ||
    !nomeCliente.trim()
  ) {
    throw new Error("ID e nome do cliente são obrigatórios.");
  }

  return {
    id: id.trim(),
    cliente: nomeCliente.trim(),
    status: STATUS.EM_ATENDIMENTO
  };
}

/* Filtra atendimentos pelo status informado */

export function filtrarAtendimentos(atendimentos, status) {
  if (!Array.isArray(atendimentos)) {
    throw new Error("Informe uma lista de atendimentos.");
  }

  if (!Object.values(STATUS).includes(status)) {
    throw new Error("Status de atendimento inválido.");
  }

  return atendimentos.filter((atendimento) => {
    return atendimento.status === status;
  });
}
