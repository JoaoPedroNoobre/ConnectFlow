import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export function iguais(a, b) {
  return timingSafeEqual(...[a, b].map(valor => createHash("sha256").update(valor).digest()));
}

export function assinaturaValida(corpo, assinatura, segredo) {
  if (!segredo || !/^sha256=[a-f0-9]{64}$/i.test(assinatura || "")) return false;
  const esperada = createHmac("sha256", segredo).update(corpo).digest();
  return timingSafeEqual(esperada, Buffer.from(assinatura.slice(7), "hex"));
}

export function verificarWebhook(params, token) {
  const desafio = params.get("hub.challenge");
  if (token && desafio && params.get("hub.mode") === "subscribe" &&
      iguais(params.get("hub.verify_token") || "", token)) return desafio;
  return null;
}

export function eventosWhatsapp(payload, numeroId) {
  const mensagens = [];
  const estados = [];
  if (payload?.object !== "whatsapp_business_account") return { mensagens, estados };
  for (const entrada of payload.entry || []) {
    for (const { field, value } of entrada.changes || []) {
      if (field !== "messages" || value?.metadata?.phone_number_id !== numeroId) continue;
      for (const msg of value.messages || []) {
        if (msg.type !== "text" || !msg.text?.body?.trim() || !msg.id || !/^[1-9]\d{9,14}$/.test(msg.from)) continue;
        const contato = (value.contacts || []).find(c => c.wa_id === msg.from);
        mensagens.push({ id: msg.id, telefone: msg.from, texto: msg.text.body.trim(),
          nome: contato?.profile?.name?.trim().slice(0, 120) || msg.from });
      }
      for (const item of value.statuses || []) {
        if (item.id && ["sent", "delivered", "read", "failed"].includes(item.status)) estados.push(item);
      }
    }
  }
  return { mensagens, estados };
}

export async function enviarTexto(telefone, texto, config, requisitar = fetch) {
  const { versao, numeroId, token } = config;
  if (!/^v\d+\.\d+$/.test(versao) || !/^\d+$/.test(numeroId) || !token) throw new Error("WhatsApp Cloud API não configurada.");
  if (!/^[1-9]\d{9,14}$/.test(telefone) || !texto.trim() || texto.length > 4096) throw new Error("Informe telefone válido e até 4096 caracteres.");
  const resposta = await requisitar(`https://graph.facebook.com/${versao}/${numeroId}/messages`, {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: telefone, type: "text", text: { body: texto } })
  });
  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok || typeof dados?.messages?.[0]?.id !== "string" || !dados.messages[0].id.trim()) {
    const erro = new Error(`Envio não confirmado pela Meta (HTTP ${resposta.status}).`);
    const recusada = resposta.status >= 400 && resposta.status < 500 && ![408, 429].includes(resposta.status);
    erro.entrega = recusada ? "falha" : "incerta";
    throw erro;
  }
  return dados.messages[0].id;
}

// Um servidor piloto ordena envios e alterações manuais na mesma fila.
export function criarFila() {
  let anterior = Promise.resolve();
  return (acao) => {
    const atual = anterior.then(acao);
    anterior = atual.catch(() => {});
    return atual;
  };
}
