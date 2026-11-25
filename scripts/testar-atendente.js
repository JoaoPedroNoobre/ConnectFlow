
import { criarInstrucoes } from "./instrucoes-ia.js";

const empresa = {
  nome: "Confeitaria ConnectFlow",
  descricao: "Confeitaria especializada em bolos e doces.",
  endereco: "JoÃ£o Pessoa - PB",
  horario: "Segunda a sÃ¡bado, das 8h Ã s 18h"
};

const produtos = [
  { nome: "Bolo de chocolate", preco: 89.90 },
  { nome: "Torta de limÃ£o", preco: 64.00 }
];

const instrucoes = criarInstrucoes(empresa, produtos);

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
        parts: [{
          text: "OlÃ¡! Quanto custa o bolo de chocolate?"
        }]
      }]
    })
  }
);

const dados = await resposta.json();

if (!resposta.ok) {
  console.log("Erro:", dados.error?.message);
} else {
  console.log("Atendente respondeu:");

const candidato = dados.candidates?.[0];

const respostaCompleta = candidato?.content?.parts
  ?.filter(parte => parte.text && !parte.thought)
  .map(parte => parte.text)
  .join("\n");

console.log(respostaCompleta);
console.log("Motivo do tÃ©rmino:", candidato?.finishReason);

}
