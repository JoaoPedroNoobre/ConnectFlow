
import test from "node:test";
import assert from "node:assert/strict";

import {
  criarAtendimento,
  alterarStatusAtendimento,
  STATUS
} from "../js/atendimentos.js";

import { definirIAAtiva } from "../js/controle-ia.js";

// Teste 1: IA começa ativa
test("novo atendimento começa com IA ativa", () => {
  const atendimento = criarAtendimento("001", "Maria");

  assert.equal(atendimento.iaAtiva, true);
});

// Teste 2: pausa e retoma o atendimento
test("pausa e retoma a IA", () => {
  const original = criarAtendimento("002", "João");

  const pausado = definirIAAtiva(original, false);
  const retomado = definirIAAtiva(pausado, true);

  assert.equal(original.iaAtiva, true);
  assert.equal(pausado.iaAtiva, false);
  assert.equal(retomado.iaAtiva, true);
});

// Teste 3: assumir conversa desativa a IA
test("assumir atendimento desativa a IA", () => {
  const atendimento = criarAtendimento("003", "Ana");

  const assumido = alterarStatusAtendimento(
    atendimento,
    STATUS.ASSUMIDO
  );

  assert.equal(assumido.iaAtiva, false);

  assert.throws(() => {
    definirIAAtiva(assumido, true);
  }, /atendimento ativo/);
});

// Teste 4: impede valor inválido
test("rejeita valor que não seja booleano", () => {
  const atendimento = criarAtendimento("004", "Pedro");

  assert.throws(() => {
    definirIAAtiva(atendimento, "sim");
  }, /true ou false/);
});
