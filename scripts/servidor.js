
/*
  ConnectFlow - Servidor local
  Abre o site, consulta o catálogo e conecta o chat com o Gemini.
*/

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { responderComGemini } from "./gemini.js";

const RAIZ = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PORTA = Number(process.env.PORT) || 5173;

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

// Acessa a tabela de produtos pelo servidor, com a chave privada.
async function acessarProdutos(metodo, produto) {
  const base = process.env.SUPABASE_URL?.trim();
  const chave = process.env.SUPABASE_SECRET_KEY?.trim();
  const cadastrando = metodo === "POST";

  if (!base || !chave) {
    return { status: 503, erro: "O catálogo do Supabase não está configurado no servidor." };
  }

  try {
    const url = new URL("/rest/v1/produtos", base);
    if (url.protocol !== "https:") throw new Error("O Supabase exige HTTPS.");

    const opcoes = {
      method: metodo,
      headers: { apikey: chave },
      redirect: "error",
      signal: AbortSignal.timeout(10000)
    };

    if (cadastrando) {
      opcoes.headers["Content-Type"] = "application/json";
      opcoes.body = JSON.stringify(produto);
    } else {
      url.searchParams.set("select", "id,nome,categoria,preco");
      url.searchParams.set("empresa_id", "eq.1");
      url.searchParams.set("order", "id.asc");
    }

    const resposta = await fetch(url, opcoes);
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

// Valida o cadastro local antes de enviar os dados ao Supabase.
async function cadastrarProduto(req, res) {
  const host = req.headers.host;
  const origemLocal = host === `localhost:${PORTA}` || host === `127.0.0.1:${PORTA}`;
  if (!origemLocal || req.headers.origin !== `http://${host}`) {
    responderJson(res, 403, { erro: "Abra o ConnectFlow no endereço local para cadastrar produtos." });
    return;
  }

  const tipo = req.headers["content-type"]?.split(";")[0].trim().toLowerCase();
  if (tipo !== "application/json") {
    responderJson(res, 415, { erro: "Envie os dados do produto em JSON." });
    return;
  }

  // Limita o tamanho recebido e preserva os acentos ao montar o texto.
  let dados;
  try {
    const partes = [];
    let tamanho = 0;
    for await (const parte of req) {
      tamanho += parte.length;
      if (tamanho > 4096) {
        responderJson(res, 413, { erro: "Os dados do produto ultrapassam o tamanho permitido." });
        return;
      }
      partes.push(parte);
    }
    dados = JSON.parse(Buffer.concat(partes).toString("utf8"));
  } catch {
    responderJson(res, 400, { erro: "Os dados do produto são inválidos." });
    return;
  }

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
