/* ==========================================================================
   Servidor estático local (sem dependências) para rodar a interface.
   Necessário porque o navegador bloqueia módulos ES (import/export) quando
   o index.html é aberto direto pelo protocolo file://.
   Uso: npm start   (ou: node scripts/servidor.js)
   ========================================================================== */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
  const caminho = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const arquivo = normalize(join(RAIZ, caminho === "/" ? "index.html" : caminho));

  // Impede acesso a arquivos fora da pasta do projeto
  if (!arquivo.startsWith(RAIZ)) {
    res.writeHead(403).end("Acesso negado");
    return;
  }

  try {
    const conteudo = await readFile(arquivo);
    res.writeHead(200, { "Content-Type": TIPOS[extname(arquivo)] ?? "application/octet-stream" });
    res.end(conteudo);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Arquivo não encontrado");
  }
}).listen(PORTA, () => {
  console.log(`ConnectFlow rodando em http://localhost:${PORTA}`);
});
