
/*
  ConnectFlow - Servidor local
  Abre o site, consulta o catálogo e conecta o chat com o Gemini.
*/

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { responderComGemini } from "./gemini.js";
import { gerarLinkWhatsApp } from "../js/whatsapp.js";
import { STATUS } from "../js/atendimentos.js";
import { assinaturaValida, verificarWebhook, eventosWhatsapp, enviarTexto, criarFila, iguais } from "./whatsapp-cloud.js";

const RAIZ = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PORTA = Number(process.env.PORT) || 5173;
const HOSPEDADO = process.env.CONNECTFLOW_HOSTED === "1" || process.env.RENDER === "true" || Boolean(process.env.RENDER_EXTERNAL_URL);
const REAL = process.env.WHATSAPP_MODE === "real";
const EMPRESA = process.env.CONNECTFLOW_EMPRESA_ID || (REAL ? "" : "1");
const ORIGEM = process.env.PANEL_ORIGIN || "";
const CLOUD = { versao: process.env.WHATSAPP_GRAPH_VERSION, numeroId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  token: process.env.WHATSAPP_ACCESS_TOKEN };
const fila = criarFila();
const assinantes = new Set();
if (!/^[1-9]\d{0,14}$/.test(EMPRESA)) throw new Error("Configure CONNECTFLOW_EMPRESA_ID.");
let credencialPainel = "";
let hostPainel = "";
if (HOSPEDADO) {
  const url = URL.canParse(ORIGEM) ? new URL(ORIGEM) : null;
  const usuario = process.env.PANEL_USER || "";
  const senha = process.env.PANEL_PASSWORD || "";
  if (!usuario.trim() || /[:\x00-\x1f\x7f]/.test(usuario) || !senha.trim() || /[\x00-\x1f\x7f]/.test(senha) ||
      url?.protocol !== "https:" || url.origin !== ORIGEM) {
    throw new Error("Configure a autenticação e a origem HTTPS do painel.");
  }
  hostPainel = url.host;
  credencialPainel = Buffer.from(`${usuario}:${senha}`, "utf8").toString("base64");
}
if (REAL && (!/^v\d+\.\d+$/.test(CLOUD.versao) || !/^\d+$/.test(CLOUD.numeroId) || !CLOUD.token ||
    !process.env.META_APP_SECRET || !process.env.WHATSAPP_VERIFY_TOKEN)) throw new Error("Configuração do WhatsApp incompleta.");
const telefonesEmCadastro = new Set();

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".json": "application/json"
};

// Envia uma resposta JSON que o navegador não guarda em cache.
function responderJson(res, status, dados) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(dados));
}

// Faz uma leitura ou cadastro no Supabase. A chave fica no servidor.
async function requisitarSupabase(tabela, filtros, dados, devolverRegistro = false, metodo = dados ? "POST" : "GET") {
  const base = process.env.SUPABASE_URL?.trim();
  const chave = process.env.SUPABASE_SECRET_KEY?.trim();

  if (!base || !chave) return null;

  const url = new URL(`/rest/v1/${tabela}`, base);
  if (url.protocol !== "https:") throw new Error("O Supabase exige HTTPS.");
  for (const [campo, valor] of Object.entries(filtros)) {
    url.searchParams.set(campo, valor);
  }

  const opcoes = {
    method: metodo,
    headers: { apikey: chave },
    redirect: "error",
    signal: AbortSignal.timeout(10000)
  };
  if (dados) {
    opcoes.headers["Content-Type"] = "application/json";
    if (devolverRegistro) opcoes.headers.Prefer = "return=representation";
    opcoes.body = JSON.stringify(dados);
  }
  return fetch(url, opcoes);
}

// Mantém a consulta e o cadastro do catálogo com as mesmas respostas.
async function acessarProdutos(metodo, produto) {
  const cadastrando = metodo === "POST";
  try {
    const filtros = cadastrando ? {} : { select: "id,nome,categoria,preco", empresa_id: `eq.${EMPRESA}`, order: "id.asc" };
    const resposta = await requisitarSupabase("produtos", filtros, produto);
    if (!resposta) {
      return { status: 503, erro: "O catálogo do Supabase não está configurado no servidor." };
    }
    if (cadastrando && resposta.status === 409) {
      return { status: 409, erro: "O cadastro entrou em conflito com os dados do catálogo." };
    }
    if (!resposta.ok) throw new Error("O Supabase recusou a solicitação.");
    if (cadastrando) return { status: 201 };

    const produtos = await resposta.json();
    if (!Array.isArray(produtos)) throw new Error("A resposta não é uma lista.");
    return { produtos };
  } catch {
    const erro = cadastrando
      ? "Não foi possível confirmar o cadastro no Supabase. Atualize o catálogo antes de tentar novamente."
      : "Não foi possível carregar o catálogo do Supabase. Tente novamente.";
    return { status: 502, erro };
  }
}

// Aceita a leitura local e exige a mesma origem no envio do formulário.
function pedidoLocal(req) {
  if (HOSPEDADO) {
    if (req.headers.host !== hostPainel) return false;
    return (req.method === "GET" && !req.headers.origin) || req.headers.origin === ORIGEM;
  }
  const host = req.headers.host;
  if (host !== `localhost:${PORTA}` && host !== `127.0.0.1:${PORTA}`) return false;
  if (req.method === "GET" && !req.headers.origin) return true;
  return req.headers.origin === `http://${host}`;
}

// Lê o formulário como JSON e limita o tamanho do pedido.
async function lerJsonCadastro(req, res, limite = 4096) {
  const tipo = req.headers["content-type"]?.split(";")[0].trim().toLowerCase();
  if (tipo !== "application/json") {
    responderJson(res, 415, { erro: "Envie os dados do cadastro em JSON." });
    return null;
  }

  try {
    const partes = [];
    let tamanho = 0;
    for await (const parte of req) {
      tamanho += parte.length;
      if (tamanho > limite) {
        responderJson(res, 413, { erro: "Os dados do cadastro ultrapassam o tamanho permitido." });
        return null;
      }
      partes.push(parte);
    }
    const dados = JSON.parse(Buffer.concat(partes).toString("utf8"));
    if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
      throw new Error("Esperava um objeto JSON.");
    }
    return dados;
  } catch {
    responderJson(res, 400, { erro: "Os dados do cadastro são inválidos." });
    return null;
  }
}

// Valida o cadastro local antes de enviar o produto ao Supabase.
async function cadastrarProduto(req, res) {
  if (!pedidoLocal(req)) {
    responderJson(res, 403, { erro: "Abra o ConnectFlow no endereço local para cadastrar produtos." });
    return;
  }

  const dados = await lerJsonCadastro(req, res);
  if (!dados) return;

  const nome = typeof dados?.nome === "string" ? dados.nome.trim() : "";
  const categoria = dados?.categoria ?? "";
  const preco = dados?.preco;
  if (!nome || nome.length > 120) {
    responderJson(res, 400, { erro: "Informe um nome de até 120 caracteres." });
    return;
  }
  if (typeof categoria !== "string" || categoria.trim().length > 120) {
    responderJson(res, 400, { erro: "Informe uma categoria de até 120 caracteres." });
    return;
  }
  if (!Number.isFinite(preco) || preco < 0 || !/^\d+(\.\d{1,2})?$/.test(String(preco))) {
    responderJson(res, 400, { erro: "Informe um preço não negativo com até duas casas decimais." });
    return;
  }

  // A empresa é definida no servidor, mesmo se a página enviar outro ID.
  const resultado = await acessarProdutos("POST", { nome, categoria: categoria.trim(), preco, empresa_id: EMPRESA });
  if (resultado.erro) {
    responderJson(res, resultado.status, { erro: resultado.erro });
  } else {
    responderJson(res, 201, { mensagem: "Produto cadastrado no Supabase." });
  }
}

// Obtém registros das tabelas de clientes e atendimentos com erros claros.
async function consultarRegistros(tabela, filtros, dados, metodo) {
  let resposta;
  try {
    resposta = await requisitarSupabase(tabela, filtros, dados, Boolean(dados), metodo);
  } catch {
    throw new Error(`Falha de conexão ao acessar ${tabela} no Supabase.`);
  }
  if (!resposta) throw new Error("O Supabase não está configurado no servidor.");

  const registros = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    if (registros?.code === "42501") {
      throw new Error(`O Supabase negou acesso à tabela ${tabela} (42501).`);
    }
    const operacao = dados ? "salvar em" : "consultar";
    throw new Error(`Não foi possível ${operacao} ${tabela} no Supabase (HTTP ${resposta.status}).`);
  }
  if (!Array.isArray(registros)) throw new Error(`Resposta inválida ao acessar ${tabela}.`);
  return registros;
}

// Busca os atendimentos e inclui o cliente, filtrando pela empresa no banco.
async function listarAtendimentosSalvos(res) {
  try {
    const atendimentos = await consultarRegistros("atendimentos", {
      select: "id::text,status,clientes!inner(nome,telefone)" + (REAL ? ",canal,revisao_ia" : ""),
      "clientes.empresa_id": `eq.${EMPRESA}`,
      order: "created_at.desc,id.desc"
    });
    responderJson(res, 200, { atendimentos });
  } catch (erro) {
    responderJson(res, 502, { erro: erro.message });
  }
}

// Reutiliza o cliente da empresa com o mesmo telefone ou cria um novo.
async function localizarOuCadastrarCliente(nome, telefone) {
  const select = "id::text,nome,telefone";
  const [cliente] = await consultarRegistros("clientes", {
    select,
    empresa_id: `eq.${EMPRESA}`,
    telefone: `eq.${telefone}`,
    order: "id.asc",
    limit: "1"
  });
  if (cliente) return cliente;

  const [criado] = await consultarRegistros("clientes", { select }, { nome, telefone, empresa_id: EMPRESA });
  if (!criado?.id) throw new Error("O Supabase não confirmou o cadastro do cliente.");
  return criado;
}

// Valida o formulário e salva o atendimento usando o ID do cliente.
async function cadastrarAtendimento(req, res) {
  const dados = await lerJsonCadastro(req, res);
  if (!dados) return;

  const nome = typeof dados.nome === "string" ? dados.nome.trim() : "";
  if (!nome || nome.length > 120) {
    responderJson(res, 400, { erro: "Informe um nome de cliente de até 120 caracteres." });
    return;
  }

  const telefone = typeof dados.telefone === "string" ? dados.telefone.replace(/\D/g, "") : "";
  try {
    gerarLinkWhatsApp(telefone);
  } catch (erro) {
    responderJson(res, 400, { erro: erro.message });
    return;
  }

  // Evita dois cadastros simultâneos para o mesmo telefone neste servidor.
  if (telefonesEmCadastro.has(telefone)) {
    responderJson(res, 409, { erro: "Já existe um cadastro em andamento para este telefone." });
    return;
  }
  telefonesEmCadastro.add(telefone);

  try {
    const cliente = await localizarOuCadastrarCliente(nome, telefone);
    const [atendimento] = await consultarRegistros(
      "atendimentos", { select: "id::text,status" }, { cliente_id: cliente.id, status: "ia_atendendo" }
    );
    if (!atendimento?.id) throw new Error("O Supabase não confirmou o cadastro do atendimento.");
    responderJson(res, 201, { atendimento: { ...atendimento, clientes: cliente } });
    avisarPainel();
  } catch (erro) {
    responderJson(res, 502, { erro: `${erro.message} Recarregue a página para conferir antes de tentar novamente.` });
  } finally {
    telefonesEmCadastro.delete(telefone);
  }
}

// Confere se o atendimento pertence a um cliente da empresa do piloto.
async function buscarAtendimentoDaEmpresa(id) {
  const [atendimento] = await consultarRegistros("atendimentos", {
    select: "id::text,status,clientes!inner(empresa_id,telefone)" + (REAL ? ",canal,revisao_ia" : ""),
    id: `eq.${id}`,
    "clientes.empresa_id": `eq.${EMPRESA}`
  });
  return atendimento;
}

// Lê o histórico em ordem cronológica, usando o ID para desempatar.
async function listarMensagens(res, id) {
  const mensagens = [];
  const filtros = {
    select: "id::text,autor,texto,created_at" + (REAL ? ",entrega" : ""),
    atendimento_id: `eq.${id}`,
    order: "created_at.asc,id.asc",
    limit: "100"
  };
  while (true) {
    const pagina = await consultarRegistros("mensagens", { ...filtros, offset: String(mensagens.length) });
    mensagens.push(...pagina);
    if (pagina.length < 100) break;
  }
  responderJson(res, 200, { mensagens });
}

// Valida o autor e guarda a mensagem com a data e o ID gerados pelo banco.
async function cadastrarMensagem(req, res, atendimento) {
  const dados = await lerJsonCadastro(req, res, 50000);
  if (!dados) return;

  const { autor } = dados;
  const texto = typeof dados.texto === "string" ? dados.texto.trim() : "";
  if (!["cliente", "ia", "humano", "sistema"].includes(autor) || !texto) {
    responderJson(res, 400, { erro: "Informe um autor válido e o texto da mensagem." });
    return;
  }

  const status = atendimento.status;
  if (REAL && atendimento.canal === "whatsapp" && autor !== "sistema") {
    if (autor !== "humano" || status !== STATUS.ASSUMIDO) {
      responderJson(res, 409, { erro: "Assuma a conversa real para responder como humano." });
      return;
    }
    if (texto.length > 4096) {
      responderJson(res, 400, { erro: "O WhatsApp aceita até 4096 caracteres por mensagem." });
      return;
    }
    const envio = await entregarWhatsapp(atendimento, autor, texto);
    responderJson(res, envio.erro ? 502 : 201, envio);
    return;
  }
  const iaAtendendo = status === "ia_atendendo" || status === STATUS.EM_ATENDIMENTO;
  if ((autor === "ia" && !iaAtendendo) ||
      (autor === "humano" && status !== STATUS.ASSUMIDO) ||
      (autor === "cliente" && status === STATUS.RESOLVIDO)) {
    responderJson(res, 409, { erro: "O status atual não permite esta mensagem. Recarregue a página." });
    return;
  }

  const [mensagem] = await consultarRegistros("mensagens", { select: "id::text,autor,texto,created_at" }, {
    atendimento_id: atendimento.id,
    autor,
    texto
  });
  if (!mensagem?.id) throw new Error("O Supabase não confirmou a mensagem.");
  responderJson(res, 201, { mensagem });
  avisarPainel();
}

// Só confirma a mudança se o status anterior ainda for o mesmo no banco.
async function atualizarStatusAtendimento(req, res, atendimento) {
  const dados = await lerJsonCadastro(req, res);
  if (!dados) return;
  if (!Object.values(STATUS).includes(dados.status)) {
    responderJson(res, 400, { erro: "Status de atendimento inválido." });
    return;
  }
  if (dados.anterior !== atendimento.status) {
    responderJson(res, 409, { erro: "O status já mudou. Recarregue a página antes de tentar novamente." });
    return;
  }

  const status = dados.status === STATUS.EM_ATENDIMENTO ? "ia_atendendo" : dados.status;
  const [atualizado] = await consultarRegistros("atendimentos", {
    id: `eq.${atendimento.id}`,
    status: `eq.${atendimento.status}`,
    select: REAL ? "status,revisao_ia" : "status"
  }, REAL ? { status, revisao_ia: Number(atendimento.revisao_ia) + 1 } : { status }, "PATCH");
  if (!atualizado) {
    responderJson(res, 409, { erro: "O status já mudou. Recarregue a página antes de tentar novamente." });
    return;
  }
  responderJson(res, 200, atualizado);
  avisarPainel();
}

function avisarPainel() {
  for (const conexao of assinantes) {
    // Clientes lentos reconectam em vez de acumular notificações em memória.
    if (!conexao.write("event: atualizar\ndata: {}\n\n")) conexao.destroy();
  }
}

function abrirEventos(res) {
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store",
    "X-Accel-Buffering": "no" });
  res.write("retry: 2000\nevent: atualizar\ndata: {}\n\n");
  assinantes.add(res);
  const pulso = setInterval(() => res.write(": pulso\n\n"), 15000);
  res.on("close", () => { clearInterval(pulso); assinantes.delete(res); });
}

async function configWhatsapp() {
  const [config] = await consultarRegistros("whatsapp_config", { empresa_id: `eq.${EMPRESA}` });
  return config || { ativa: false, revisao: 0, agente: {}, empresa: {} };
}

async function salvarConfigWhatsapp(req, res) {
  const dados = await lerJsonCadastro(req, res, 12000);
  if (!dados) return;
  const anterior = await configWhatsapp();
  if (typeof dados.ativa !== "boolean" || !dados.agente || typeof dados.agente !== "object" ||
      Array.isArray(dados.agente) || typeof dados.empresa?.nome !== "string" || !dados.empresa.nome.trim()) {
    responderJson(res, 400, { erro: "Informe a configuração do agente e o nome da empresa." });
    return;
  }
  const valores = { ativa: dados.ativa, agente: dados.agente, empresa: dados.empresa, revisao: Number(anterior.revisao) + 1 };
  const [config] = anterior.empresa_id
    ? await consultarRegistros("whatsapp_config", { empresa_id: `eq.${EMPRESA}` }, valores, "PATCH")
    : await consultarRegistros("whatsapp_config", {}, { ...valores, empresa_id: EMPRESA });
  if (!config) throw new Error("O banco não confirmou as configurações.");
  responderJson(res, 200, { config });
  avisarPainel();
}

// Guarda a tentativa antes de enviar. Aceitação pela Meta não significa entrega.
async function entregarWhatsapp(atendimento, autor, texto) {
  if (texto.length > 4096) throw new Error("O WhatsApp aceita até 4096 caracteres por mensagem.");
  const select = "id::text,autor,texto,created_at,entrega";
  const [tentativa] = await consultarRegistros("mensagens", { select }, {
    atendimento_id: atendimento.id, autor, texto, entrega: "enviando"
  });
  if (!tentativa?.id) throw new Error("O banco não confirmou o registro da tentativa.");
  avisarPainel();
  let resultado;
  try {
    const whatsapp_id = await enviarTexto(atendimento.clientes.telefone, texto, CLOUD);
    resultado = { whatsapp_id, entrega: "aceita" };
  } catch (erro) {
    resultado = { entrega: erro.entrega === "falha" ? "falha" : "incerta" };
  }
  try {
    const [mensagem] = await consultarRegistros("mensagens", { select, id: `eq.${tentativa.id}` }, resultado, "PATCH");
    if (!mensagem?.id || mensagem.entrega !== resultado.entrega) throw new Error("Tentativa não atualizada.");
    avisarPainel();
    if (resultado.entrega === "aceita") return { mensagem };
    const erro = resultado.entrega === "falha"
      ? "A Meta recusou o envio."
      : "A Meta não confirmou o envio. Confira o histórico antes de reenviar.";
    return { mensagem, erro };
  } catch {
    return { mensagem: tentativa, erro: "Não foi possível registrar o resultado do envio. Confira o histórico antes de reenviar." };
  }
}

async function responderWhatsapp(id, texto, versoes) {
  const catalogo = await acessarProdutos("GET");
  if (catalogo.erro) throw new Error("Catálogo indisponível para resposta automática.");
  const resposta = (await responderComGemini(versoes.config.empresa, catalogo.produtos, texto, versoes.config.agente)).trim();
  if (!resposta) return;
  await fila(async () => {
    const atual = await buscarAtendimentoDaEmpresa(id);
    const config = await configWhatsapp();
    if (config.ativa && config.revisao === versoes.config.revisao &&
        atual?.status === "ia_atendendo" && atual.revisao_ia === versoes.conversa) {
      const envio = await entregarWhatsapp(atual, "ia", resposta);
      if (envio.erro) console.error("Envio automático não confirmado.");
    }
  });
}

async function webhookWhatsapp(req, res) {
  if (!REAL) return res.writeHead(404).end();
  if (req.method === "GET") {
    const desafio = verificarWebhook(new URL(req.url, "http://localhost").searchParams, process.env.WHATSAPP_VERIFY_TOKEN);
    return res.writeHead(desafio === null ? 403 : 200, { "Content-Type": "text/plain" }).end(desafio ?? "");
  }
  if (req.method !== "POST") return res.writeHead(405, { Allow: "GET, POST" }).end();
  const partes = [];
  let tamanho = 0;
  try {
    for await (const parte of req) {
      tamanho += parte.length;
      if (tamanho > 512000) return res.writeHead(413).end();
      partes.push(parte);
    }
    const corpo = Buffer.concat(partes);
    if (!assinaturaValida(corpo, req.headers["x-hub-signature-256"], process.env.META_APP_SECRET)) {
      return res.writeHead(403).end();
    }
    let evento;
    try { evento = JSON.parse(corpo.toString("utf8")); } catch { return res.writeHead(400).end(); }
    const { mensagens, estados } = eventosWhatsapp(evento, CLOUD.numeroId);
    for (const msg of mensagens) {
      const trabalho = await fila(async () => {
        const [registro] = await consultarRegistros("rpc/receber_whatsapp", {}, {
          p_empresa: EMPRESA, p_telefone: msg.telefone, p_nome: msg.nome, p_id: msg.id, p_texto: msg.texto
        });
        if (!registro) return;
        avisarPainel();
        const atual = await buscarAtendimentoDaEmpresa(registro.atendimento_id);
        const config = await configWhatsapp();
        if (config.ativa && atual?.status === "ia_atendendo") {
          return { id: atual.id, config, conversa: atual.revisao_ia };
        }
      });
      if (trabalho) responderWhatsapp(trabalho.id, msg.texto, trabalho).catch(() => console.error("Resposta automática não concluída."));
    }
    await fila(async () => {
      const etapas = { sent: ["enviada", "aceita"], delivered: ["entregue", "aceita,enviada"],
        read: ["lida", "aceita,enviada,entregue"], failed: ["falha", "aceita,enviada"] };
      for (const item of estados) {
        const [entrega, anteriores] = etapas[item.status];
        await consultarRegistros("mensagens", { whatsapp_id: `eq.${item.id}`, entrega: `in.(${anteriores})` }, { entrega }, "PATCH");
      }
      if (estados.length) avisarPainel();
    });
    res.writeHead(200).end();
  } catch {
    res.writeHead(503).end();
  }
}

// Encaminha as rotas de histórico e status depois de verificar o acesso local.
async function atenderConversa(req, res, id, recurso) {
  if (!pedidoLocal(req)) {
    responderJson(res, 403, { erro: "Abra o ConnectFlow no endereço local para acessar a conversa." });
    return;
  }
  const metodos = recurso ? ["GET", "POST"] : ["PATCH"];
  if (!metodos.includes(req.method)) {
    res.setHeader("Allow", metodos.join(", "));
    responderJson(res, 405, { erro: "Método não disponível para esta rota." });
    return;
  }
  try {
    const acao = async () => {
      const atendimento = await buscarAtendimentoDaEmpresa(id);
      if (!atendimento) {
        responderJson(res, 404, { erro: "Atendimento não encontrado." });
      } else if (req.method === "GET") {
        await listarMensagens(res, id);
      } else if (req.method === "POST") {
        await cadastrarMensagem(req, res, atendimento);
      } else {
        await atualizarStatusAtendimento(req, res, atendimento);
      }
    };
    if (REAL && req.method !== "GET") await fila(acao);
    else await acao();
  } catch (erro) {
    responderJson(res, 502, { erro: erro.message });
  }
}

export const servidor = createServer(async (req, res) => {

  let caminho;

  try {
    caminho = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname
    );
  } catch {
    res.writeHead(400).end("Endereco invalido");
    return;
  }

  if (caminho === "/health" && req.method === "GET") return responderJson(res, 200, { ok: true });
  if (caminho === "/webhooks/whatsapp") return webhookWhatsapp(req, res);
  if (HOSPEDADO) {
    const acesso = /^Basic ([A-Za-z0-9+/=]+)$/i.exec(req.headers.authorization || "");
    if (!acesso || !iguais(acesso[1], credencialPainel)) {
      return res.writeHead(401, { "WWW-Authenticate": 'Basic realm="ConnectFlow", charset="UTF-8"', "Cache-Control": "no-store" }).end();
    }
    res.setHeader("Cache-Control", "no-store");
    if (caminho.startsWith("/api/") && !pedidoLocal(req)) return responderJson(res, 403, { erro: "Origem do painel inválida." });
  }
  if (caminho === "/api/whatsapp/config" || caminho === "/api/eventos") {
    if (!pedidoLocal(req)) return responderJson(res, 403, { erro: "Origem do painel inválida." });
    if (caminho === "/api/eventos" && req.method === "GET") return abrirEventos(res);
    try {
      if (req.method === "GET" && caminho === "/api/whatsapp/config") {
        return responderJson(res, 200, { real: REAL, config: REAL ? await configWhatsapp() : null });
      }
      if (req.method === "POST" && REAL && caminho === "/api/whatsapp/config") {
        return await fila(() => salvarConfigWhatsapp(req, res));
      }
      return responderJson(res, 405, { erro: "Operação indisponível." });
    } catch {
      return responderJson(res, 502, { real: REAL, erro: "Configuração do WhatsApp indisponível." });
    }
  }

  // Impede acesso a arquivos privados
  if (caminho.split(/[\\/]/).some(parte => parte.startsWith("."))) {
    res.writeHead(403).end("Acesso negado");
    return;
  }

  const conversa = caminho.match(/^\/api\/atendimentos\/([1-9]\d{0,18})(\/mensagens)?$/);
  if (conversa) {
    await atenderConversa(req, res, conversa[1], conversa[2]);
    return;
  }

  if (caminho === "/api/atendimentos") {
    if (req.method !== "GET" && req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      responderJson(res, 405, { erro: "Use GET para consultar ou POST para cadastrar atendimentos." });
    } else if (!pedidoLocal(req)) {
      responderJson(res, 403, { erro: "Abra o ConnectFlow no endereço local para acessar os atendimentos." });
    } else if (req.method === "GET") {
      await listarAtendimentosSalvos(res);
    } else {
      await cadastrarAtendimento(req, res);
    }
    return;
  }

  if (caminho === "/api/produtos") {
    if (req.method === "POST") {
      await cadastrarProduto(req, res);
      return;
    }
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET, POST");
      responderJson(res, 405, { erro: "Use GET para consultar ou POST para cadastrar produtos." });
      return;
    }

    const catalogo = await acessarProdutos("GET");
    if (catalogo.erro) {
      responderJson(res, catalogo.status, { erro: catalogo.erro });
    } else {
      responderJson(res, 200, { produtos: catalogo.produtos });
    }
    return;
  }

  // Rota que conecta o chat ao Gemini
  if (req.method === "POST" && caminho === "/api/ia") {

    if (!process.env.GEMINI_API_KEY) {
      res.writeHead(503).end("Gemini nao configurado");
      return;
    }

    try {
      let corpo = "";
      let tamanho = 0;

      // Recebe os dados enviados pelo chat
      for await (const parte of req) {
        tamanho += parte.length;

        if (tamanho > 20000) {
          res.writeHead(413).end("Mensagem muito grande");
          return;
        }

        corpo += parte.toString();
      }

      const dados = JSON.parse(corpo);

      if (!dados || typeof dados !== "object") {
        res.writeHead(400).end("Dados invalidos");
        return;
      }

      // Recebe a pergunta e as configurações. O catálogo vem do Supabase.
      const {
        empresa,
        pergunta,
        config = {}
      } = dados;

      // Valida os dados recebidos
      if (
        !empresa ||
        typeof empresa.nome !== "string" ||
        !empresa.nome.trim() ||
        typeof pergunta !== "string" ||
        !pergunta.trim() ||
        !config ||
        typeof config !== "object" ||
        Array.isArray(config)
      ) {
        res.writeHead(400).end("Dados invalidos");
        return;
      }

      const catalogo = await acessarProdutos("GET");
      if (catalogo.erro) {
        responderJson(res, catalogo.status, { erro: catalogo.erro });
        return;
      }

      // Usa os preços do banco, mesmo se o navegador enviar outros produtos.
      const resposta = await responderComGemini(
        empresa,
        catalogo.produtos,
        pergunta,
        config
      );

      responderJson(res, 200, { resposta });

    } catch (erro) {
      if (erro instanceof SyntaxError) {
        res.writeHead(400).end("JSON invalido");
      } else {
        console.error("Erro na IA:", erro.message);
        res.writeHead(502).end("Erro ao consultar a IA");
      }
    }

    return;
  }

  // Abre somente os arquivos públicos da interface.
  if (!["/", "/index.html"].includes(caminho) && !/^\/(?:assets|css|js)\/[\w/-]+\.(?:svg|png|jpg|ico|css|js)$/.test(caminho)) {
    return res.writeHead(404).end("Arquivo não encontrado.");
  }

  // Abre os arquivos do site
  const arquivo = resolve(
    RAIZ,
    "." + (caminho === "/" ? "/index.html" : caminho)
  );

  // Impede acessar arquivos fora do projeto
  if (!arquivo.startsWith(RAIZ + sep)) {
    res.writeHead(403).end("Acesso negado");
    return;
  }

  try {
    const conteudo = await readFile(arquivo);

    res.writeHead(200, {
      "Content-Type": TIPOS[extname(arquivo)] ??
        "application/octet-stream"
    });

    res.end(conteudo);

  } catch {
    res.writeHead(404, {
      "Content-Type": "text/plain; charset=utf-8"
    }).end("Arquivo nao encontrado");
  }

}).listen(PORTA, HOSPEDADO ? "0.0.0.0" : "127.0.0.1", () => {
  console.log(`ConnectFlow rodando em http://localhost:${PORTA}`);
});
