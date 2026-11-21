
import test from "node:test";
import assert from "node:assert/strict";

import { calcularMetricas } from "../js/dashboard.js";
import { STATUS } from "../js/atendimentos.js";

// Teste 1: verifica os cálculos do Dashboard
test("calcula as metricas corretamente", () => {
  const atendimentos = [
    { status: STATUS.EM_ATENDIMENTO },
    { status: STATUS.EM_ATENDIMENTO },
    { status: STATUS.AGUARDANDO_HUMANO },
    { status: STATUS.RESOLVIDO },
    { status: STATUS.ASSUMIDO }
  ];

  const resultado = calcularMetricas(atendimentos);

  assert.deepEqual(resultado, {
    total: 5,
    emAtendimento: 2,
    aguardandoHumano: 1,
    resolvidos: 1,
    assumidos: 1
  });
});

// Teste 2: verifica o Dashboard sem atendimentos
test("retorna zero quando nao existem atendimentos", () => {
  const resultado = calcularMetricas([]);

  assert.deepEqual(resultado, {
    total: 0,
    emAtendimento: 0,
    aguardandoHumano: 0,
    resolvidos: 0,
    assumidos: 0
  });
});

// Teste 3: verifica se dados inválidos são rejeitados
test("rejeita dados que nao sao uma lista", () => {
  assert.throws(() => {
    calcularMetricas("texto invalido");
  }, /Informe uma lista de atendimentos/);
});
