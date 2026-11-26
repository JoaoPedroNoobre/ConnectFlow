
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

const RAIZ = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PORTA = Number(process.env.PORT) || 5173;
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
    const filtros = cadastrando ? {} : { select: "id,nome,categoria,preco", empresa_id: "eq.1", order: "id.asc" };
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
  const resultado = await acessarProdutos("POST", { nome, categoria: categoria.trim(), preco, empresa_id: 1 });
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
      select: "id::text,status,clientes!inner(nome,telefone)",
      "clientes.empresa_id": "eq.1",
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
    empresa_id: "eq.1",
    telefone: `eq.${telefone}`,
    order: "id.asc",
    limit: "1"
  });
  if (cliente) return cliente;

  const [criado] = await consultarRegistros("clientes", { select }, { nome, telefone, empresa_id: 1 });
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
  } catch (erro) {
    responderJson(res, 502, { erro: `${erro.message} Recarregue a página para conferir antes de tentar novamente.` });
  } finally {
    telefonesEmCadastro.delete(telefone);
  }
}

// Confere se o atendimento pertence a um cliente da empresa 1.
async function buscarAtendimentoDaEmpresa(id) {
  const [atendimento] = await consultarRegistros("atendimentos", {
    select: "id::text,status,clientes!inner(empresa_id)",
    id: `eq.${id}`,
    "clientes.empresa_id": "eq.1"
  });
  return atendimento;
}

// Lê o histórico em ordem cronológica, usando o ID para desempatar.
async function listarMensagens(res, id) {
  const mensagens = [];
  const filtros = {
    select: "id::text,autor,texto,created_at",
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
    select: "status"
  }, { status }, "PATCH");
  if (!atualizado) {
    responderJson(res, 409, { erro: "O status já mudou. Recarregue a página antes de tentar novamente." });
    return;
  }
  responderJson(res, 200, { status: atualizado.status });
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
  } catch (erro) {
    responderJson(res, 502, { erro: erro.message });
  }
}

createServer(async (req, res) => {

  let caminho;

  try {
    caminho = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname
    );
  } catch {
    res.writeHead(400).end("Endereco invalido");
    return;
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

  // Impede acessar o codigo privado do servidor
  if (caminho === "/scripts" || caminho.startsWith("/scripts/")) {
    res.writeHead(403).end("Acesso negado");
    return;
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

}).listen(PORTA, "127.0.0.1", () => {
  console.log(`ConnectFlow rodando em http://localhost:${PORTA}`);
});
