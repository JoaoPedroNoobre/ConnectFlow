import test from "node:test";
import assert from "node:assert/strict";
import { iniciarSincronizacaoWhatsapp } from "../js/sincronizacao-whatsapp.js";
import { adicionarMensagem, carregarAtendimentos, buscarAtendimento } from "../js/estado.js";
import { iniciarDashboard } from "../js/telas/dashboard.js";

function prepararEventos() {
  const eventos = {
    addEventListener(nome, receber) { this[nome] = receber; }
  };
  const esperas = new Set();
  return {
    eventos, esperas,
    abrirEventos: () => eventos,
    agendar: (acao) => { esperas.add(acao); return acao; },
    cancelar: (acao) => esperas.delete(acao)
  };
}

test("SSE atualiza os contadores do Dashboard, tenta novamente e recupera a conexão", async (t) => {
  const conexao = prepararEventos();
  const avisos = [];
  const elementos = {};
  const fetchAnterior = globalThis.fetch;
  const documentoAnterior = globalThis.document;
  globalThis.document = {
    querySelector(id) {
      return elementos[id] ??= {
        selectedOptions: [{ textContent: "Hoje" }], addEventListener() {}, style: {},
        classList: { add() {} }, setAttribute() {}
      };
    }
  };
  t.after(() => { globalThis.document = documentoAnterior; globalThis.fetch = fetchAnterior; });
  let status = "ia_atendendo";
  let falhou = false;
  let modoIndisponivel = true;
  let consultas = 0;
  const mensagens = [];
  globalThis.fetch = async (url, opcoes) => {
    if (opcoes?.method === "POST") {
      return Response.json({ erro: "A Meta não confirmou o envio.", mensagem: mensagens[0] }, { status: 502 });
    }
    assert.equal(url, "/api/atendimentos");
    consultas++;
    if (falhou) return Response.json({ erro: "Banco momentaneamente indisponível" }, { status: 502 });
    return Response.json({ atendimentos: [{
      id: "88", status, revisao_ia: status === "assumido" ? 2 : 1, clientes: { nome: "Contato de teste" }
    }] });
  };

  iniciarDashboard();
  await iniciarSincronizacaoWhatsapp({
    ...conexao,
    lerModo: async () => { if (modoIndisponivel) throw Error("Sem configuração"); return true; },
    atualizar: carregarAtendimentos,
    mostrar: aviso => avisos.push(aviso)
  });
  assert.match(avisos.at(-1), /Tentando novamente/);
  modoIndisponivel = false;
  await [...conexao.esperas][0]();
  await conexao.eventos.atualizar();
  assert.equal(elementos["#kpiIA"].textContent, 1);

  falhou = true;
  await conexao.eventos.atualizar();
  assert.match(avisos.at(-1), /atualização indisponível/);
  assert.equal(elementos["#kpiIA"].textContent, 1);
  falhou = false;
  status = "assumido";
  await [...conexao.esperas][0]();
  assert.equal(elementos["#kpiAssumidos"].textContent, 1);

  conexao.eventos.onerror();
  assert.match(avisos.at(-1), /reconectando/);
  const antes = consultas;
  await conexao.eventos.atualizar();
  assert.equal(consultas, antes + 1);
  assert.match(avisos.at(-1), /modo real/);
  conexao.eventos.readyState = 2;
  conexao.eventos.onerror();
  assert.match(avisos.at(-1), /Recarregue/);

  mensagens.push({ id: "10", autor: "humano", texto: "Mensagem teste", entrega: "incerta", created_at: "2026-11-26T15:00:00Z" });
  await assert.rejects(adicionarMensagem("88", mensagens[0]), /Meta não confirmou/);
  assert.equal(buscarAtendimento("88").mensagens[0].entrega, "incerta");
});

test("modo simulado funciona sem abrir SSE", async () => {
  const avisos = [];
  await iniciarSincronizacaoWhatsapp({
    lerModo: async () => false,
    abrirEventos: () => { throw Error("Não deve abrir SSE"); },
    atualizar: async () => {},
    mostrar: aviso => avisos.push(aviso)
  });
  assert.deepEqual(avisos, ["Simulador · desenvolvimento"]);
});

test("agrupa avisos recebidos durante a leitura sem perder a atualização seguinte", async () => {
  const conexao = prepararEventos();
  let concluir;
  let quantidade = 0;
  await iniciarSincronizacaoWhatsapp({
    ...conexao,
    lerModo: async () => true,
    atualizar: async () => {
      quantidade++;
      if (quantidade === 1) await new Promise(resolve => { concluir = resolve; });
    },
    mostrar() {}
  });
  const primeira = conexao.eventos.atualizar();
  await conexao.eventos.atualizar();
  await conexao.eventos.atualizar();
  concluir();
  await primeira;
  assert.equal(quantidade, 2);
});
