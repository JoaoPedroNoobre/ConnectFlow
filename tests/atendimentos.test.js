
import test from "node:test";
import assert from "node:assert/strict";

import {
  criarAtendimento,
  alterarStatusAtendimento,
  STATUS
} from "../js/atendimentos.js";

// Teste 1: verifica se o status pode ser alterado.
test("altera o status de um atendimento", () => {
  const atendimento = criarAtendimento("001", "Maria");

  const atualizado = alterarStatusAtendimento(
    atendimento,
    STATUS.ASSUMIDO
  );

  assert.equal(atualizado.status, STATUS.ASSUMIDO);
});

// Teste 2: impede a utilização de status inválidos.
test("rejeita um status inválido", () => {
  const atendimento = criarAtendimento("002", "João");

  assert.throws(() => {
    alterarStatusAtendimento(atendimento, "cancelado");
  }, /Status de atendimento inválido/);
});

// Teste 3: verifica se o objeto original é preservado.
test("não modifica o atendimento original", () => {
  const atendimento = criarAtendimento("003", "Ana");

  alterarStatusAtendimento(atendimento, STATUS.RESOLVIDO);

  assert.equal(
    atendimento.status,
    STATUS.EM_ATENDIMENTO
  );
});
