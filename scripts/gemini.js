
import { criarInstrucoes } from "./instrucoes-ia.js";

export async function responderComGemini(empresa, produtos, pergunta, config = {}) {
  const instrucoes = criarInstrucoes(empresa, produtos, config);

  const resposta = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: instrucoes }]
        },
        contents: [{
          parts: [{ text: pergunta }]
        }]
      })
    }
  );

  const dados = await resposta.json();

  if (!resposta.ok) {
    throw new Error("Erro ao consultar o Gemini.");
  }

  const partes = dados.candidates?.[0]?.content?.parts || [];

  return partes
    .filter(parte => parte.text && !parte.thought)
    .map(parte => parte.text)
    .join("\n");
}
