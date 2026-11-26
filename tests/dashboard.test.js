
import test from "node:test";
import assert from "node:assert/strict";

import { calcularMetricas } from "../js/dashboard.js";
import { STATUS, RESPONSAVEIS } from "../js/atendimentos.js";
import { ORIGENS } from "../js/origem.js";

// Teste 1: verifica todas as métricas
test("calcula todas as métricas corretamente", () => {
  const atendimentos = [
    { status: STATUS.EM_ATENDIMENTO },
    { status: STATUS.AGUARDANDO_HUMANO },
    {
      status: STATUS.RESOLVIDO,
      resolvidoPor: RESPONSAVEIS.IA,
      origem: ORIGENS.INSTAGRAM
    },
    {
      status: STATUS.RESOLVIDO,
      resolvidoPor: RESPONSAVEIS.HUMANO
    },
    { status: STATUS.ASSUMIDO }
  ];

  const resultado = calcularMetricas(atendimentos);

  assert.deepEqual(resultado, {
    total: 5,
    emAtendimento: 1,
    aguardandoHumano: 1,
    resolvidos: 2,
    assumidos: 1,
    resolvidosIA: 1,
    resolvidosHumanos: 1,
    origemInstagram: 1,
    taxaResolucaoIA: 50
  });
});

// Teste 2: verifica lista vazia
test("retorna zero sem atendimentos", () => {
  assert.deepEqual(calcularMetricas([]), {
    total: 0,
    emAtendimento: 0,
    aguardandoHumano: 0,
    resolvidos: 0,
    assumidos: 0,
    resolvidosIA: 0,
    resolvidosHumanos: 0,
    origemInstagram: 0,
    taxaResolucaoIA: 0
  });
});

// Teste 3: impede dados inválidos
test("rejeita dados inválidos", () => {
  assert.throws(() => {
    calcularMetricas("texto");
  }, /Informe uma lista de atendimentos/);
});

// Teste 4: verifica resoluções sem responsável
test("não conta responsável desconhecido na taxa", () => {
  const atendimentos = [
    { status: STATUS.RESOLVIDO },
    {
      status: STATUS.RESOLVIDO,
      resolvidoPor: RESPONSAVEIS.IA
    }
  ];

  const resultado = calcularMetricas(atendimentos);

  assert.equal(resultado.resolvidos, 2);
  assert.equal(resultado.taxaResolucaoIA, 100);
});
