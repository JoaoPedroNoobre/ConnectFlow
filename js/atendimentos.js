
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


/* Altera o status de um atendimento */
export function alterarStatusAtendimento(atendimento, novoStatus) {

  // Verifica se o atendimento é um objeto válido
  if (!atendimento || typeof atendimento !== "object" ||
      Array.isArray(atendimento)) {
    throw new Error("Atendimento inválido.");
  }

  // Verifica se o novo status existe no sistema
  if (!Object.values(STATUS).includes(novoStatus)) {
    throw new Error("Status de atendimento inválido.");
  }

  // Retorna uma cópia do atendimento com o novo status
  return {
    ...atendimento,
    status: novoStatus
  };
}

