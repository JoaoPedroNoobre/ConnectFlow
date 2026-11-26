
import test from "node:test";
import assert from "node:assert/strict";

import { gerarLinkWhatsApp } from "../js/whatsapp.js";

// Teste 1: verifica a criação de um link.
test("gera um link com mensagem", () => {
  const link = gerarLinkWhatsApp(
    "5583999999999",
    "Olá, vim do Instagram!"
  );

  assert.equal(
    link,
    "https://wa.me/5583999999999?text=Ol%C3%A1%2C%20vim%20do%20Instagram!"
  );
});

// Teste 2: verifica um número inválido.
test("rejeita telefone inválido", () => {
  assert.throws(() => {
    gerarLinkWhatsApp("abc");
  }, /Informe um telefone válido com DDI/);
});
