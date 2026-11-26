import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { request } from "node:http";
import { createHmac } from "node:crypto";
import { spawnSync } from "node:child_process";

test("Render recusa iniciar sem credenciais válidas e origem HTTPS exata", () => {
  const base = {
    ...process.env, RENDER: "true", CONNECTFLOW_HOSTED: "0", WHATSAPP_MODE: "simulado",
    CONNECTFLOW_EMPRESA_ID: "1", PANEL_USER: "teste", PANEL_PASSWORD: "senha-ficticia",
    PANEL_ORIGIN: "https://connectflow-teste.invalid"
  };
  for (const invalido of [
    { PANEL_USER: "" }, { PANEL_PASSWORD: "   " }, { PANEL_USER: "teste:outro" },
    { PANEL_ORIGIN: "http://connectflow-teste.invalid" },
    { PANEL_ORIGIN: "https://teste@connectflow-teste.invalid" },
    { PANEL_ORIGIN: "https://connectflow-teste.invalid?x=1" },
    { RENDER: "", RENDER_EXTERNAL_URL: "https://connectflow-teste.invalid", PANEL_PASSWORD: "" }
  ]) {
    const processo = spawnSync(process.execPath, ["--input-type=module", "-e", 'await import("./scripts/servidor.js")'], {
      env: { ...base, ...invalido }, encoding: "utf8", timeout: 4000
    });
    assert.equal(processo.status, 1, processo.error?.message);
    assert.match(processo.stderr, /Configure a autenticação e a origem HTTPS/);
    assert.doesNotMatch(processo.stdout, /ConnectFlow rodando/);
  }
});

test("webhook, persistência, cancelamento, autenticação e eventos do painel", async (t) => {
  const porta = 5190;
  const host = "connectflow-teste.invalid";
  const origem = "https://" + host;
  const segredo = "app-secret-ficticio";
  Object.assign(process.env, {
    PORT: String(porta), CONNECTFLOW_HOSTED: "0", RENDER: "true", PANEL_ORIGIN: origem, PANEL_USER: "teste",
    PANEL_PASSWORD: "senha-ficticia", SUPABASE_URL: "https://banco-teste.invalid",
    SUPABASE_SECRET_KEY: "chave-ficticia", GEMINI_API_KEY: "ficticia", WHATSAPP_MODE: "real",
    CONNECTFLOW_EMPRESA_ID: "7", WHATSAPP_GRAPH_VERSION: "v99.0", WHATSAPP_ACCESS_TOKEN: "ficticio",
    WHATSAPP_PHONE_NUMBER_ID: "42", META_APP_SECRET: segredo, WHATSAPP_VERIFY_TOKEN: "verificar"
  });
  const recebidas = new Set();
  const mensagens = [];
  const conversa = { id: "8", status: "ia_atendendo", canal: "whatsapp", revisao_ia: 0, clientes: { telefone: "5511000000000" } };
  const config = { ativa: true, revisao: 1, empresa_id: 7, empresa: { nome: "Teste" }, agente: {} };
  const consultas = [];
  let envios = 0;
  let respostaMeta = "aceita";
  let falharRegistro = false;
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async (url, opcoes) => {
    url = new URL(url);
    const corpo = opcoes.body && JSON.parse(opcoes.body);
    if (url.hostname === "generativelanguage.googleapis.com") {
      return new Promise(resolve => consultas.push(() => resolve(Response.json({
        candidates: [{ content: { parts: [{ text: "Resposta de teste" }] } }]
      }))));
    }
    if (url.hostname === "graph.facebook.com") {
      envios++;
      if (respostaMeta === "recusa") return Response.json({}, { status: 400 });
      if (respostaMeta === "timeout") throw new DOMException("Timeout", "TimeoutError");
      if (respostaMeta === "sem-id") return Response.json({ messages: [] });
      return Response.json({ messages: [{ id: "wamid." + envios }] });
    }
    assert.equal(url.hostname, "banco-teste.invalid");
    const tabela = url.pathname.split("/").at(-1);
    if (tabela === "receber_whatsapp") {
      assert.equal(corpo.p_empresa, "7");
      assert.equal(opcoes.headers.Prefer, "return=representation");
      if (recebidas.has(corpo.p_id)) return Response.json([]);
      recebidas.add(corpo.p_id);
      mensagens.push({ autor: "cliente", texto: corpo.p_texto, whatsapp_id: corpo.p_id });
      return Response.json([{ atendimento_id: "8" }]);
    }
    if (tabela === "atendimentos") {
      if (opcoes.method === "PATCH") {
        if (url.searchParams.get("status") !== "eq." + conversa.status) return Response.json([]);
        Object.assign(conversa, corpo);
      } else {
        assert.equal(url.searchParams.get("clientes.empresa_id"), "eq.7");
      }
      return Response.json([conversa]);
    }
    if (tabela === "whatsapp_config") {
      if (opcoes.method === "PATCH") Object.assign(config, corpo);
      return Response.json([config]);
    }
    if (tabela === "produtos") return Response.json([]);
    if (tabela === "mensagens") {
      if (opcoes.method === "GET") return Response.json(mensagens);
      if (opcoes.method === "POST") {
        const mensagem = { id: String(mensagens.length + 1), ...corpo };
        mensagens.push(mensagem);
        return Response.json([mensagem]);
      }
      const registro = mensagens.find(m =>
        "eq." + m.id === url.searchParams.get("id") || "eq." + m.whatsapp_id === url.searchParams.get("whatsapp_id"));
      const etapas = url.searchParams.get("entrega");
      if (falharRegistro && corpo.entrega === "aceita") return Response.json({}, { status: 503 });
      if (!registro || (etapas && !etapas.slice(4, -1).split(",").includes(registro.entrega))) return Response.json([]);
      Object.assign(registro, corpo);
      return Response.json([registro]);
    }
    throw new Error("Rota inesperada no teste.");
  };
  const { servidor } = await import("../scripts/servidor.js");
  t.after(() => { servidor.closeAllConnections(); servidor.close(); globalThis.fetch = fetchOriginal; });
  if (!servidor.listening) await once(servidor, "listening");

  const autorizacao = "Basic " + Buffer.from("teste:senha-ficticia").toString("base64");
  function chamar(path, method = "GET", dados, extra = {}) {
    return new Promise((resolve, reject) => {
      const cliente = request({ hostname: "127.0.0.1", port: porta, path, method, headers: {
        Host: host, Origin: origem, Authorization: autorizacao, "Content-Type": "application/json", ...extra
      } }, async resposta => {
        const partes = [];
        for await (const parte of resposta) partes.push(parte);
        resolve({ status: resposta.statusCode, texto: Buffer.concat(partes).toString() });
      });
      cliente.on("error", reject);
      cliente.end(dados === undefined ? undefined : JSON.stringify(dados));
    });
  }
  const evento = (messages, statuses) => ({ object: "whatsapp_business_account", entry: [{ changes: [
    { field: "messages", value: { metadata: { phone_number_id: "42" }, messages, statuses } }
  ] }] });
  function webhook(dados) {
    const assinatura = createHmac("sha256", segredo).update(JSON.stringify(dados)).digest("hex");
    return chamar("/webhooks/whatsapp", "POST", dados, { "X-Hub-Signature-256": "sha256=" + assinatura });
  }
  const entrada = (id) => evento([{ id, type: "text", from: "5511000000000", text: { body: id } }]);
  async function esperar(condicao) {
    for (let i = 0; i < 100 && !condicao(); i++) await new Promise(r => setTimeout(r, 10));
    assert.ok(condicao());
  }

  assert.equal((await chamar("/", "GET", undefined, { Authorization: "" })).status, 401);
  for (const rota of ["/api/atendimentos", "/api/atendimentos/8/mensagens", "/api/eventos", "/api/whatsapp/config", "/api/produtos", "/api/ia"]) {
    assert.equal((await chamar(rota, "GET", undefined, { Authorization: "" })).status, 401);
  }
  assert.equal((await chamar("/api/atendimentos", "GET", undefined, { Host: "outro.invalid" })).status, 403);
  assert.equal((await chamar("/api/atendimentos/8", "PATCH", { status: "assumido" }, { Origin: "https://outro.invalid" })).status, 403);
  assert.equal((await chamar("/api/atendimentos", "GET", undefined, { Authorization: autorizacao.replace("Basic", "basic") })).status, 200);
  assert.equal((await chamar("/health", "GET", undefined, { Authorization: "" })).status, 200);
  assert.equal((await chamar("/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verificar&hub.challenge=abc")).texto, "abc");
  assert.equal((await chamar("/webhooks/whatsapp", "POST", entrada("invalida"))).status, 403);

  let eventosPainel = "";
  const stream = request({ hostname: "127.0.0.1", port: porta, path: "/api/eventos",
    headers: { Host: host, Authorization: autorizacao } }, res => res.on("data", dados => { eventosPainel += dados; }));
  stream.on("error", () => {});
  t.after(() => stream.destroy());
  stream.end();
  await esperar(() => eventosPainel.includes("event: atualizar"));
  assert.equal((await webhook(entrada("evento-1"))).status, 200);
  await esperar(() => consultas.length === 1 && eventosPainel.match(/event: atualizar/g)?.length > 1);
  assert.equal((await webhook(entrada("evento-1"))).status, 200);
  assert.equal(recebidas.size, 1);
  assert.equal(consultas.length, 1);

  assert.equal((await chamar("/api/atendimentos/8", "PATCH", { anterior: "ia_atendendo", status: "assumido" })).status, 200);
  const humano = (texto) => chamar("/api/atendimentos/8/mensagens", "POST", { autor: "humano", texto });
  const aceita = await humano("Resposta humana");
  assert.equal(aceita.status, 201);
  assert.equal(JSON.parse(aceita.texto).mensagem.entrega, "aceita");
  assert.equal(envios, 1);
  assert.equal(mensagens.at(-1).entrega, "aceita");
  await webhook(evento([], [{ id: "wamid.1", status: "delivered" }]));
  assert.equal(mensagens.at(-1).entrega, "entregue");
  await webhook(evento([], [{ id: "wamid.1", status: "sent" }]));
  assert.equal(mensagens.at(-1).entrega, "entregue");
  await webhook(evento([], [{ id: "wamid.1", status: "read" }]));
  assert.equal(mensagens.at(-1).entrega, "lida");
  for (const [resposta, entrega] of [["recusa", "falha"], ["timeout", "incerta"], ["sem-id", "incerta"]]) {
    respostaMeta = resposta;
    const resultado = await humano("Erro esperado: " + resposta);
    assert.equal(resultado.status, 502);
    const corpo = JSON.parse(resultado.texto);
    assert.equal(corpo.mensagem.entrega, entrega);
    assert.equal(mensagens.at(-1).entrega, entrega);
    assert.match(corpo.erro, /Meta/);
  }
  respostaMeta = "aceita";
  falharRegistro = true;
  const pendente = await humano("Banco indisponível após o envio");
  assert.equal(pendente.status, 502);
  assert.equal(JSON.parse(pendente.texto).mensagem.entrega, "enviando");
  falharRegistro = false;

  await chamar("/api/atendimentos/8", "PATCH", { anterior: "assumido", status: "em_atendimento" });
  consultas.shift()();
  await webhook(entrada("evento-2"));
  await esperar(() => consultas.length === 1);
  await chamar("/api/whatsapp/config", "POST", { ativa: false, empresa: { nome: "Teste" }, agente: {} });
  consultas.shift()();
  await webhook(entrada("evento-3"));
  assert.equal(envios, 5);
  assert.equal(consultas.length, 0);
  stream.destroy();
  let reconectado = "";
  const novoStream = request({ hostname: "127.0.0.1", port: porta, path: "/api/eventos",
    headers: { Host: host, Authorization: autorizacao } }, res => res.on("data", dados => { reconectado += dados; }));
  novoStream.on("error", () => {});
  t.after(() => novoStream.destroy());
  novoStream.end();
  await esperar(() => reconectado.includes("event: atualizar"));
  const historico = JSON.parse((await chamar("/api/atendimentos/8/mensagens")).texto);
  assert.equal(historico.mensagens.length, 8);
  await chamar("/api/whatsapp/config", "POST", { ativa: true, empresa: { nome: "Teste" }, agente: {} });
  await webhook(entrada("evento-4"));
  await esperar(() => consultas.length === 1);
  await chamar("/api/whatsapp/config", "POST", { ativa: false, empresa: { nome: "Teste" }, agente: {} });
  await chamar("/api/whatsapp/config", "POST", { ativa: true, empresa: { nome: "Teste" }, agente: {} });
  consultas.shift()();
  await webhook(entrada("evento-5"));
  await esperar(() => consultas.length === 1);
  consultas.shift()();
  await esperar(() => mensagens.at(-1)?.autor === "ia" && mensagens.at(-1)?.entrega === "aceita");
  assert.equal(envios, 6);
});
