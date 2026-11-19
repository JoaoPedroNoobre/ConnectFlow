
export function responderCliente(mensagem, produtos, iaAtiva) {
  if (!iaAtiva) {
    return null;
  }

  for (let produto of produtos) {
    if (mensagem.toLowerCase().includes(produto.nome.toLowerCase())) {
      return `O produto ${produto.nome} custa R$ ${produto.preco}.`;
    }
  }

  return "Não encontrei essa informação. Vou chamar um atendente.";
}
