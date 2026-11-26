import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { assinaturaValida, verificarWebhook, eventosWhatsapp, enviarTexto, criarFila } from "../scripts/whatsapp-cloud.js";

test("valida os bytes originais da assinatura e o token de verificação", () => {
  const corpo = Buffer.from('{"texto":"Olá"}');
  const assinatura = "sha256=" + createHmac("sha256", "segredo-ficticio").update(corpo).digest("hex");
  assert.equal(assinaturaValida(corpo, assinatura, "segredo-ficticio"), true);
  assert.equal(assinaturaValida(Buffer.from("{}"), assinatura, "segredo-ficticio"), false);
  assert.equal(assinaturaValida(corpo, undefined, "segredo-ficticio"), false);
  const params = new URLSearchParams({ "hub.mode": "subscribe", "hub.challenge": "123", "hub.verify_token": "teste" });
  assert.equal(verificarWebhook(params, "teste"), "123");
  assert.equal(verificarWebhook(params, "outro"), null);
});

test("aceita somente texto e eventos do número configurado", () => {
  const valor = { metadata: { phone_number_id: "100" }, messages: [
    { type: "image", id: "1", from: "5511000000000" },
    { type: "text", id: "2", from: "5511000000000", text: { body: " Olá " } }
  ] };
  const evento = { object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: valor }] }] };
  assert.deepEqual(eventosWhatsapp(evento, "100").mensagens.map(m => m.texto), ["Olá"]);
  assert.deepEqual(eventosWhatsapp(evento, "200").mensagens, []);
});

test("envia pela Graph API e diferencia aceitação e erro da Meta", async () => {
  const config = { versao: "v99.0", numeroId: "100", token: "ficticio" };
  const id = await enviarTexto("5511000000000", "Olá", config, async (url, req) => {
    assert.equal(url, "https://graph.facebook.com/v99.0/100/messages");
    assert.equal(req.headers.Authorization, "Bearer ficticio");
    assert.equal(JSON.parse(req.body).text.body, "Olá");
    return Response.json({ messages: [{ id: "wamid.teste" }] });
  });
  assert.equal(id, "wamid.teste");
  await assert.rejects(enviarTexto("5511000000000", "Olá", config,
    async () => new Response(null, { status: 400 })), /HTTP 400/);
});

test("ordena a pausa antes de um envio pendente e continua depois de falhas", async () => {
  const fila = criarFila();
  let ativa = true;
  const pausa = fila(() => { ativa = false; });
  const envio = fila(() => ativa);
  await pausa;
  assert.equal(await envio, false);
  await assert.rejects(fila(() => { throw new Error("falha"); }), /falha/);
  assert.equal(await fila(() => "funciona"), "funciona");
});
