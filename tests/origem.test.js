
import test from "node:test";
import assert from "node:assert/strict";

import { criarAtendimento } from "../js/atendimentos.js";

import {
  registrarOrigem,
  ORIGENS
} from "../js/origem.js";

test("registra origem Instagram", () => {
  const atendimento = criarAtendimento("001", "Maria");

  const resultado = registrarOrigem(
    atendimento,
    ORIGENS.INSTAGRAM
  );

  assert.equal(resultado.origem, "instagram");
  assert.equal(atendimento.origem, undefined);
});

test("rejeita origem inválida", () => {
  const atendimento = criarAtendimento("002", "João");

  assert.throws(() => {
    registrarOrigem(atendimento, "tiktok");
  }, /Origem inválida/);
});
