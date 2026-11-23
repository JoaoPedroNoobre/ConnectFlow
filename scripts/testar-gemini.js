
const chave = process.env.GEMINI_API_KEY;

if (!chave) {
  console.log("Chave da API não encontrada.");
  process.exit(1);
}

const resposta = await fetch(
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": chave
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: "Responda em português: apresente-se como atendente virtual do ConnectFlow em uma frase curta."
        }]
      }]
    })
  }
);

const dados = await resposta.json();

if (!resposta.ok) {
  console.log("Erro da API:", resposta.status);
  console.log(dados.error?.message || "Erro desconhecido");
} else {
  console.log("Resposta do Gemini:");
  console.log(dados.candidates?.[0]?.content?.parts?.[0]?.text);
}
