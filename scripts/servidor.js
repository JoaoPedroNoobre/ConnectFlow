
/*
  ConnectFlow - Servidor local
  Abre o site e conecta o chat com o Gemini.
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

      // Informacoes da empresa, produtos e configuracoes
      const {
        empresa,
        produtos,
        pergunta,
        config = {}
      } = dados;

      // Valida os dados recebidos
      if (
        !empresa ||
        typeof empresa.nome !== "string" ||
        !empresa.nome.trim() ||
        !Array.isArray(produtos) ||
        typeof pergunta !== "string" ||
        !pergunta.trim() ||
        !config ||
        typeof config !== "object" ||
        Array.isArray(config)
      ) {
        res.writeHead(400).end("Dados invalidos");
        return;
      }

      // Envia os dados para o Gemini
      const resposta = await responderComGemini(
        empresa,
        produtos,
        pergunta,
        config
      );

      // Retorna a resposta para o chat
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      });

      res.end(JSON.stringify({ resposta }));

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
